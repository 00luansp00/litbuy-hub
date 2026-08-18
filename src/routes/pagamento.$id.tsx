import { useEffect, useRef } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AuthGate } from "@/components/auth/AuthGate";
import { Breadcrumb } from "@/components/common/Breadcrumb";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api/client";
import { formatBrlMinor, useBuyerOrder } from "@/services/orders";
import {
  createInitiationKeyManager,
  useBuyerPayment,
  usePaymentActions,
} from "@/services/payments";
export const Route = createFileRoute("/pagamento/$id")({ component: PaymentPage });
const key = (kind: string, code: string) => `${kind}-${code}-${crypto.randomUUID()}`;
function PaymentPage() {
  const { id } = Route.useParams();
  return (
    <AuthGate
      title="Entre para pagar o pedido"
      description="Você precisa estar logado para acessar o pagamento."
    >
      <PaymentContent orderCode={id} />
    </AuthGate>
  );
}
export function PaymentContent({ orderCode }: { orderCode: string }) {
  const navigate = useNavigate();
  const order = useBuyerOrder(orderCode),
    payment = useBuyerPayment(orderCode),
    actions = usePaymentActions(orderCode);
  const initiateKey = useRef(createInitiationKeyManager(() => key("payment", orderCode)));
  const confirmKeys = useRef(new Map<string, string>());
  useEffect(() => {
    const persisted = payment.data;
    if (
      persisted?.paymentStatus === "PAID" &&
      ["ACTIVE", "COMPLETED"].includes(persisted.orderStatus) &&
      persisted.orderCode
    ) {
      void navigate({ to: "/pedidos/$id", params: { id: persisted.orderCode }, replace: true });
    }
  }, [navigate, payment.data]);
  if (order.isPending || payment.isPending)
    return (
      <div className="container-lit py-10">
        <span className="sr-only">Carregando pagamento...</span>
        <Skeleton className="h-48" />
      </div>
    );
  if (order.isError || payment.isError) {
    const error = order.error ?? payment.error;
    const unavailable = error instanceof ApiError && error.status === 404;
    return (
      <main role="alert" className="container-lit py-10">
        <h1 className="text-xl font-bold">
          {unavailable ? "Pagamento indisponível" : "Não foi possível carregar o pagamento"}
        </h1>
        <Button
          className="mt-4"
          variant="outline"
          onClick={() => {
            void order.refetch();
            void payment.refetch();
          }}
        >
          Tentar novamente
        </Button>
      </main>
    );
  }
  const o = order.data,
    p = payment.data;
  const eligible =
    o.status === "PENDING_PAYMENT" && ["NOT_CREATED", "PENDING"].includes(o.paymentStatus);
  const blocking =
    p.attemptId && ["PENDING", "PROCESSING", "REQUIRES_ACTION"].includes(p.status ?? "");
  const busy = actions.initiate.isPending || actions.confirm.isPending;
  const mutationError = actions.initiate.error ?? actions.confirm.error;
  return (
    <main className="container-lit space-y-6 py-6 md:py-10">
      <Breadcrumb
        items={[
          { label: "Meus pedidos", to: "/pedidos" },
          { label: o.orderCode, to: "/pedidos/$id", params: { id: o.orderCode } },
          { label: "Pagamento" },
        ]}
      />
      <section className="rounded-xl border p-5">
        <p className="font-semibold text-warning">
          Ambiente Alpha — simulação segura, sem dinheiro real
        </p>
        <h1 className="mt-2 text-2xl font-bold">Pagamento do pedido {o.orderCode}</h1>
        <p className="mt-2">Seller: {o.seller.storeName}</p>
        <p className="text-xl font-bold">{formatBrlMinor(p.amountMinor)}</p>
      </section>
      <section className="space-y-3 rounded-xl border p-5">
        <h2 className="text-lg font-bold">Estado real do backend</h2>
        <p>Pedido: {p.orderStatus}</p>
        <p>Pagamento: {p.paymentStatus}</p>
        <p>
          Tentativa: {p.status ?? "Ainda não iniciada"}
          {p.attemptNumber ? ` (#${p.attemptNumber})` : ""}
        </p>
        {eligible && !blocking && (
          <Button
            disabled={busy}
            onClick={() =>
              actions.initiate.mutate({
                key: initiateKey.current({ attemptId: p.attemptId, status: p.status }),
              })
            }
          >
            Iniciar pagamento Alpha
          </Button>
        )}
        {blocking && p.alphaSimulationAvailable && (
          <Button
            disabled={busy}
            onClick={() => {
              const id = p.attemptId!;
              let k = confirmKeys.current.get(id);
              if (!k) {
                k = key("confirm", id);
                confirmKeys.current.set(id, k);
              }
              actions.confirm.mutate({ attemptId: id, key: k });
            }}
          >
            Simular aprovação Alpha
          </Button>
        )}
        {blocking && !p.alphaSimulationAvailable && (
          <p>A simulação Alpha não está disponível neste ambiente.</p>
        )}
        {!eligible && <p>Este pedido não aceita uma nova tentativa de pagamento.</p>}
        {mutationError && (
          <p role="alert" className="text-destructive">
            {mutationError instanceof ApiError
              ? mutationError.code
              : "Falha ao processar pagamento"}
          </p>
        )}
      </section>
      <Button asChild variant="outline">
        <Link to="/pedidos/$id" params={{ id: o.orderCode }}>
          Voltar para o pedido real
        </Link>
      </Button>
    </main>
  );
}
