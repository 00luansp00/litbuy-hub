# Roadmap incremental do comércio

**Status: plano futuro; implementação ainda não iniciada.** A fonte autoritativa é `COMMERCE_ARCHITECTURE.md`. Não agrupar as fases em uma única PR.

## PR #36 — carrinhos persistentes

Modelos, migrations, endpoints autenticados, autorização e controle otimista; nenhum estoque reservado e nenhum pagamento.

## PR #37 — checkout e núcleo de pedido

Snapshot, centavos, pedido por vendedor, idempotência, reserva atômica, cancelamento e expiração; sem gateway.

## PR #38 — leitura real de pedidos no frontend

Visão do comprador e estados seguros, sem pagamento fictício.

## PR posterior

Adapter e pagamento sandbox somente depois da seleção formal do provedor.

## Fases seguintes

Webhook; ledger; split/retenção; entrega; disputa; reembolso; chargeback; wallet; saque; conciliação. Cada fase recebe revisão, testes e PR própria.
