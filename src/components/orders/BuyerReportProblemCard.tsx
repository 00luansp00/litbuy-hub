import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api/client";
import { formatOrderDate, type BuyerOrder, useReportBuyerOrderProblem } from "@/services/orders";

const activeStatuses = ["OPEN", "UNDER_REVIEW"] as const;

export function BuyerReportProblemCard({ order }: { order: BuyerOrder }) {
  const report = useReportBuyerOrderProblem(order.orderCode);
  const active = order.disputeCases.find(
    (item) => item.status === activeStatuses[0] || item.status === activeStatuses[1],
  );
  const error = report.isError
    ? report.error instanceof ApiError && report.error.status === 409
      ? "Este pedido já possui um caso ativo. Atualizamos a situação real do pedido."
      : report.error instanceof ApiError && [401, 403].includes(report.error.status)
        ? "Sua sessão não permite reportar este pedido. Entre novamente na conta Buyer."
        : report.error instanceof ApiError && report.error.status === 404
          ? "Pedido não encontrado ou indisponível para esta conta."
          : "Não foi possível registrar o problema. Tente novamente."
    : null;

  return (
    <section aria-labelledby="report-problem-title" className="rounded-xl border p-5">
      <h2 id="report-problem-title" className="text-lg font-bold">
        Reportar problema
      </h2>
      {active ? (
        <div className="mt-2" aria-live="polite">
          <p className="font-medium">Problema registrado</p>
          <p className="text-sm text-muted-foreground">
            Caso {active.status === "OPEN" ? "aberto" : "em análise"} desde{" "}
            {formatOrderDate(active.createdAt)}.
          </p>
        </div>
      ) : (
        <>
          <p className="mt-2 text-sm text-muted-foreground">
            Registre um caso para este pedido. A equipe poderá analisá-lo; esta ação não decide
            reembolso nem movimenta valores.
          </p>
          <Button
            className="mt-4"
            variant="outline"
            disabled={report.isPending}
            onClick={() => report.mutate()}
          >
            {report.isPending ? "Registrando..." : "Reportar problema"}
          </Button>
        </>
      )}
      {report.isSuccess && (
        <p role="status" className="mt-3 text-sm">
          O problema foi registrado com sucesso.
        </p>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
