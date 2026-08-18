import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OrderChatCard } from "@/components/orders/OrderChatCard";
import { ApiError } from "@/lib/api/client";
import { ORDER_CHAT_POLL_INTERVAL, orderChatService } from "@/services/orderChat";

const code = "LIT-23456789ABCDEF";
const ids = [
  "123e4567-e89b-42d3-a456-426614174000",
  "123e4567-e89b-42d3-a456-426614174002",
  "123e4567-e89b-42d3-a456-426614174003",
];
const item = (index: number, author: "SELF" | "COUNTERPARTY", text: string, createdAt: string) => ({
  messageId: ids[index],
  clientMessageId: `123e4567-e89b-42d3-a456-42661417400${index + 4}`,
  author,
  text,
  createdAt,
});
const makeClient = () =>
  new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });
const renderChat = (client = makeClient()) =>
  render(
    <QueryClientProvider client={client}>
      <OrderChatCard orderCode={code} perspective="buyer" counterpartLabel="Loja Real" />
    </QueryClientProvider>,
  );

describe("OrderChatCard real", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(orderChatService, "readMessages").mockResolvedValue({ items: [], nextCursor: null });
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("mostra empty state real, contador e bloqueia whitespace-only", async () => {
    const send = vi.spyOn(orderChatService, "sendMessage");
    renderChat();
    expect(await screen.findByText("Nenhuma mensagem ainda.")).toBeInTheDocument();
    const textarea = screen.getByLabelText("Mensagem");
    expect(screen.getByText("0 / 4000")).toBeInTheDocument();
    fireEvent.change(textarea, { target: { value: "   \n" } });
    expect(screen.getByText("4 / 4000")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enviar" })).toBeDisabled();
    expect(send).not.toHaveBeenCalled();
    expect(textarea).toHaveAttribute("maxlength", "4000");
  });

  it("renderiza autores, ordem cronológica, texto HTML inerte, quebras e remove duplicatas", async () => {
    vi.spyOn(orderChatService, "readMessages").mockResolvedValue({
      items: [
        item(1, "SELF", "mais nova", "2026-08-18T10:02:00.000Z"),
        item(0, "COUNTERPARTY", "<b>teste</b>\nlinha 2", "2026-08-18T10:01:00.000Z"),
        item(0, "COUNTERPARTY", "<b>teste</b>\nlinha 2", "2026-08-18T10:01:00.000Z"),
      ],
      nextCursor: null,
    });
    const { container } = renderChat();
    await screen.findByText("mais nova");
    expect(screen.getByText("Você:")).toBeInTheDocument();
    expect(screen.getByText("Loja Real:")).toBeInTheDocument();
    expect(screen.getAllByText(/<b>teste<\/b>/)).toHaveLength(1);
    expect(container.querySelector("b")).toBeNull();
    expect(screen.getByText(/<b>teste<\/b>/)).toHaveClass("whitespace-pre-wrap", "break-words");
    const texts = [...container.querySelectorAll("article > p:last-child")].map(
      (node) => node.textContent,
    );
    expect(texts).toEqual(["<b>teste</b>\nlinha 2", "mais nova"]);
  });

  it("envia UUID, preserva texto e limpa após confirmação", async () => {
    const send = vi
      .spyOn(orderChatService, "sendMessage")
      .mockImplementation(async (_code, input) =>
        item(2, "SELF", input.text, "2026-08-18T10:03:00.000Z"),
      );
    renderChat();
    await screen.findByText("Nenhuma mensagem ainda.");
    fireEvent.change(screen.getByLabelText("Mensagem"), { target: { value: "  teste  " } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));
    await waitFor(() =>
      expect(send).toHaveBeenCalledWith(code, {
        clientMessageId: expect.stringMatching(/^[0-9a-f-]{36}$/i),
        text: "  teste  ",
      }),
    );
    await waitFor(() => expect(screen.getByLabelText("Mensagem")).toHaveValue(""));
  });

  it("mantém texto e UUID no retry, mas cria UUID ao editar após erro", async () => {
    const send = vi
      .spyOn(orderChatService, "sendMessage")
      .mockRejectedValue(new TypeError("network"));
    renderChat();
    await screen.findByText("Nenhuma mensagem ainda.");
    const textarea = screen.getByLabelText("Mensagem");
    fireEvent.change(textarea, { target: { value: "primeira" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));
    await screen.findByRole("button", { name: "Tentar novamente" });
    const firstId = send.mock.calls[0][1].clientMessageId;
    expect(textarea).toHaveValue("primeira");
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    await waitFor(() => expect(send).toHaveBeenCalledTimes(2));
    expect(send.mock.calls[1][1].clientMessageId).toBe(firstId);
    fireEvent.change(textarea, { target: { value: "editada" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));
    await waitFor(() => expect(send).toHaveBeenCalledTimes(3));
    expect(send.mock.calls[2][1].clientMessageId).not.toBe(firstId);
  });

  it("mostra feedback controlado para conflito 409", async () => {
    vi.spyOn(orderChatService, "sendMessage").mockRejectedValue(
      new ApiError(409, "ORDER_CHAT_MESSAGE_IDEMPOTENCY_CONFLICT", "privado"),
    );
    renderChat();
    await screen.findByText("Nenhuma mensagem ainda.");
    fireEvent.change(screen.getByLabelText("Mensagem"), { target: { value: "teste" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("intenção conflita");
    expect(screen.queryByText("privado")).not.toBeInTheDocument();
  });

  it("carrega página anterior usando cursor", async () => {
    const read = vi
      .spyOn(orderChatService, "readMessages")
      .mockResolvedValueOnce({
        items: [item(1, "SELF", "nova", "2026-08-18T10:02:00.000Z")],
        nextCursor: ids[2],
      })
      .mockResolvedValueOnce({
        items: [item(0, "COUNTERPARTY", "antiga", "2026-08-18T10:01:00.000Z")],
        nextCursor: null,
      });
    renderChat();
    fireEvent.click(await screen.findByRole("button", { name: "Carregar mensagens anteriores" }));
    await screen.findByText("antiga");
    expect(read).toHaveBeenCalledWith(code, { cursor: ids[2], limit: 30 });
  });

  it("configura polling e exibe mensagem recebida por refetch sem F5", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const read = vi
      .spyOn(orderChatService, "readMessages")
      .mockResolvedValueOnce({ items: [], nextCursor: null })
      .mockResolvedValue({
        items: [item(0, "COUNTERPARTY", "chegou", "2026-08-18T10:01:00.000Z")],
        nextCursor: null,
      });
    renderChat();
    await screen.findByText("Nenhuma mensagem ainda.");
    await vi.advanceTimersByTimeAsync(ORDER_CHAT_POLL_INTERVAL);
    expect(await screen.findByText("chegou")).toBeInTheDocument();
    expect(read).toHaveBeenCalledTimes(2);
  });
});
