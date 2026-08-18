import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api/client";
import {
  useOrderChatMessages,
  useSendOrderChatMessage,
  type SendOrderChatMessage,
} from "@/services/orderChat";

export type OrderChatCardProps = {
  orderCode: string;
  perspective: "buyer" | "seller";
  counterpartLabel?: string;
};
const isUnavailable = (error: Error | null) =>
  error instanceof ApiError &&
  (error.status === 404 ||
    error.code === "ORDER_CHAT_NOT_FOUND" ||
    error.code === "ORDER_CHAT_UNAVAILABLE");

export function OrderChatCard({ orderCode, counterpartLabel }: OrderChatCardProps) {
  const history = useOrderChatMessages(orderCode);
  const send = useSendOrderChatMessage(orderCode);
  const [text, setText] = useState("");
  const intent = useRef<SendOrderChatMessage | null>(null);
  const messages = useMemo(() => {
    const unique = new Map(
      history.data?.pages
        .flatMap((page) => page.items)
        .map((message) => [message.messageId, message]),
    );
    return [...unique.values()].sort(
      (a, b) => a.createdAt.localeCompare(b.createdAt) || a.messageId.localeCompare(b.messageId),
    );
  }, [history.data]);
  const changeText = (value: string) => {
    setText(value);
    if (intent.current?.text !== value) intent.current = null;
    if (send.isError) send.reset();
  };
  const submit = () => {
    if (!text.trim() || text.length > 4000 || send.isPending) return;
    const current =
      intent.current?.text === text
        ? intent.current
        : { clientMessageId: crypto.randomUUID(), text };
    intent.current = current;
    send.mutate(current, {
      onSuccess: () => {
        intent.current = null;
        setText("");
      },
    });
  };
  const error = history.error ?? send.error;
  const message = isUnavailable(error)
    ? "Chat indisponível para esta conta ou pedido."
    : error instanceof ApiError && error.code === "ORDER_CHAT_MESSAGE_IDEMPOTENCY_CONFLICT"
      ? "Não foi possível repetir este envio porque a intenção conflita com uma mensagem anterior. Edite o texto e tente novamente."
      : "Não foi possível atualizar o chat. Tente novamente.";
  return (
    <section aria-labelledby="order-chat-title" className="rounded-xl border p-5">
      <header>
        <h2 id="order-chat-title" className="text-xl font-bold">
          Chat do pedido
        </h2>
        <p className="text-sm font-medium">Pedido {orderCode}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Conversa privada entre comprador e vendedor.
        </p>
      </header>
      {history.hasNextPage && (
        <Button
          className="mt-4"
          type="button"
          variant="outline"
          disabled={history.isFetchingNextPage}
          onClick={() => void history.fetchNextPage()}
        >
          {history.isFetchingNextPage ? "Carregando..." : "Carregar mensagens anteriores"}
        </Button>
      )}
      <div aria-live="polite" className="my-4 max-h-96 space-y-3 overflow-y-auto border-y py-4">
        {history.isPending && (
          <p className="text-sm text-muted-foreground">Carregando mensagens...</p>
        )}
        {!history.isPending && !history.isError && messages.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhuma mensagem ainda.</p>
        )}
        {messages.map((item) => {
          const self = item.author === "SELF";
          return (
            <article
              key={item.messageId}
              className={
                self
                  ? "ml-auto max-w-[85%] rounded-lg bg-primary/10 p-3"
                  : "max-w-[85%] rounded-lg bg-muted p-3"
              }
            >
              <p className="text-xs font-semibold">
                {self ? "Você" : (counterpartLabel ?? "Outra pessoa")}:
              </p>
              <p className="whitespace-pre-wrap break-words text-sm">{item.text}</p>
            </article>
          );
        })}
      </div>
      {error && (
        <p role="alert" className="mb-3 text-sm text-destructive">
          {message}
        </p>
      )}
      {history.isError && !isUnavailable(history.error) && (
        <Button type="button" variant="outline" onClick={() => void history.refetch()}>
          Tentar carregar novamente
        </Button>
      )}
      {!isUnavailable(history.error) && (
        <div className="mt-3 space-y-2">
          <label htmlFor={`order-chat-${orderCode}`} className="text-sm font-medium">
            Mensagem
          </label>
          <Textarea
            id={`order-chat-${orderCode}`}
            value={text}
            maxLength={4000}
            onChange={(event) => changeText(event.target.value)}
            placeholder="Escreva uma mensagem"
            rows={3}
          />
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              Não compartilhe senhas ou informações sensíveis.
            </p>
            <span className="text-xs text-muted-foreground">{text.length} / 4000</span>
          </div>
          <Button
            type="button"
            disabled={!text.trim() || text.length > 4000 || send.isPending}
            onClick={submit}
          >
            {send.isPending ? "Enviando..." : send.isError ? "Tentar novamente" : "Enviar"}
          </Button>
        </div>
      )}
    </section>
  );
}
