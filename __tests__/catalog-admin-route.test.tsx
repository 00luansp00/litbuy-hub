import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const service = {
  categories: vi.fn(),
  subcategories: vi.fn(),
  attributes: vi.fn(),
  createCategory: vi.fn(),
  updateCategory: vi.fn(),
  createSubcategory: vi.fn(),
  updateSubcategory: vi.fn(),
  createAttribute: vi.fn(),
  updateAttribute: vi.fn(),
};
const toast = { success: vi.fn(), error: vi.fn() };

vi.mock("sonner", () => ({ toast }));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: Record<string, unknown>) => options,
}));
vi.mock("@/components/admin/AdminLayout", () => ({
  AdminLayout: ({ children, title }: { children: React.ReactNode; title: string }) => (
    <main>
      <h1>{title}</h1>
      {children}
    </main>
  ),
}));
vi.mock("@/components/admin/AdminDashboardSection", () => ({
  AdminDashboardSection: ({
    children,
    title,
    actions,
  }: {
    children: React.ReactNode;
    title: string;
    actions?: React.ReactNode;
  }) => (
    <section>
      <h2>{title}</h2>
      {actions}
      {children}
    </section>
  ),
}));
vi.mock("@/services/catalogService", () => ({
  CATALOG_ALLOWED_ICON_KEYS: ["Gift", "LayoutGrid"],
  catalogService: { admin: service },
}));

const categoryA = {
  id: "00000000-0000-4000-8000-000000000001",
  slug: "contas",
  name: "Contas",
  description: null,
  icon: "Gift",
  iconKey: "Gift",
  color: "#8B5CF6",
  colorHex: "#8B5CF6",
  featured: true,
  sortOrder: 1,
  status: "ACTIVE",
};
const categoryB = {
  ...categoryA,
  id: "00000000-0000-4000-8000-000000000002",
  slug: "skins",
  name: "Skins",
  featured: false,
};
const subcategory = {
  id: "00000000-0000-4000-8000-000000000101",
  categoryId: categoryA.id,
  slug: "valorant",
  name: "Valorant",
  status: "ACTIVE",
  sortOrder: 1,
};
const attribute = {
  id: "00000000-0000-4000-8000-000000001001",
  subcategoryId: null,
  productType: "virtual_currency",
  key: "quantidade",
  label: "Quantidade",
  inputType: "number",
  type: "number",
  options: undefined,
  selectOptions: [],
  required: false,
  sortOrder: 1,
  status: "ACTIVE",
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}
function renderRoute() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return import("@/routes/admin.catalogo").then((mod) =>
    render(
      <QueryClientProvider client={queryClient}>
        {React.createElement(mod.Route.component)}
      </QueryClientProvider>,
    ),
  );
}

beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
  service.categories.mockResolvedValue([categoryA, categoryB]);
  service.subcategories.mockResolvedValue([subcategory]);
  service.attributes.mockResolvedValue([attribute]);
  service.createCategory.mockResolvedValue(categoryA);
  service.updateCategory.mockResolvedValue(categoryA);
  service.createSubcategory.mockResolvedValue(subcategory);
  service.updateSubcategory.mockResolvedValue(subcategory);
  service.createAttribute.mockResolvedValue(attribute);
  service.updateAttribute.mockResolvedValue(attribute);
  vi.stubGlobal(
    "confirm",
    vi.fn(() => true),
  );
});

describe("/admin/catalogo", () => {
  it("shows loading, error retry, baseline and category create/cancel", async () => {
    service.categories.mockReturnValueOnce(new Promise(() => undefined));
    await renderRoute();
    expect(screen.getByText(/Carregando taxonomia real/i)).toBeInTheDocument();
    cleanup();
    service.categories.mockRejectedValueOnce(new Error("down"));
    await renderRoute();
    expect(await screen.findByText(/Falha ao carregar catálogo/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Tentar novamente/i }));
    cleanup();
    service.categories.mockResolvedValue([categoryA]);
    await renderRoute();
    expect((await screen.findAllByText("Contas")).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: /Nova categoria/i }));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent(/Nova categoria/i);
    fireEvent.change(dialog.querySelector('input[name="name"]')!, {
      target: { value: "Nova Categoria" },
    });
    fireEvent.change(dialog.querySelector('input[name="slug"]')!, {
      target: { value: "nova-categoria" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Salvar/i }));
    await waitFor(() => expect(service.createCategory).toHaveBeenCalled());
  });

  it("keeps two simultaneous category mutations pending on their own rows", async () => {
    const first = deferred<typeof categoryA>();
    const second = deferred<typeof categoryB>();
    service.updateCategory.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    await renderRoute();
    expect((await screen.findAllByText("Contas")).length).toBeGreaterThan(0);
    const switches = screen.getAllByRole("switch");
    fireEvent.click(switches[0]);
    fireEvent.click(switches[1]);
    expect(switches[0]).toBeDisabled();
    expect(switches[1]).toBeDisabled();
    second.resolve(categoryB);
    await waitFor(() => expect(switches[1]).not.toBeDisabled());
    expect(switches[0]).toBeDisabled();
    first.resolve(categoryA);
    await waitFor(() => expect(switches[0]).not.toBeDisabled());
  });

  it("lists and edits attributes including conflict errors", async () => {
    await renderRoute();
    expect(await screen.findByText("Quantidade")).toBeInTheDocument();
    service.updateAttribute.mockRejectedValueOnce(
      Object.assign(new Error("Conflito"), { code: "CATALOG_ATTRIBUTE_KEY_CONFLICT" }),
    );
    const switches = screen.getAllByRole("switch");
    fireEvent.click(switches[switches.length - 1]);
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining("CATALOG_ATTRIBUTE_KEY_CONFLICT"),
      ),
    );
  });
});
