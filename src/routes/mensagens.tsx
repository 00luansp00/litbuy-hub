import { createFileRoute, Link } from "@tanstack/react-router";
import { AuthGate } from "@/components/auth/AuthGate";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/mensagens")({
  component: MensagensPage,
  head: () => ({
    meta: [{ title: "Conversas dos pedidos — LIT Buy" }, { name: "robots", content: "noindex" }],
  }),
});

function MensagensPage() {
  return (
    <AuthGate
      title="Entre para acessar suas conversas"
      description="Você precisa estar logado para acessar seus pedidos e vendas."
    >
      <main className="container-lit py-10">
        <section className="mx-auto max-w-2xl rounded-xl border p-6 text-center">
          <h1 className="text-2xl font-bold">Conversas dos pedidos</h1>
          <p className="mt-3 text-muted-foreground">
            As conversas reais ficam vinculadas diretamente a cada pedido ou venda.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Não compartilhe senhas ou informações sensíveis.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button asChild>
              <Link to="/pedidos">Meus pedidos</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/vendedor/vendas">Minhas vendas</Link>
            </Button>
          </div>
        </section>
      </main>
    </AuthGate>
  );
}
