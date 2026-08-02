# Roadmap incremental do comércio

**Status: roadmap incremental; PRs #36, #37 e #38 implementadas, com fases financeiras futuras ainda não iniciadas.** A fonte autoritativa é `COMMERCE_ARCHITECTURE.md`. Não agrupar as fases em uma única PR.

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

## PR #36 — persistent buyer carts (implemented)

The authenticated persistent cart foundation is implemented with database integrity, owner-only BUYER APIs, CSRF mutations, optimistic versions, current-catalog reconciliation, and no stock reservation. Checkout, orders, payments, and real money remain unimplemented. See `CART_FOUNDATION.md`; PR #37 is the next incremental step.

## PR #37 — checkout and order core

The backend contains the server-side checkout and persistent pending-order foundation described in `ORDER_CHECKOUT_FOUNDATION.md`. It uses cart preview fingerprints, immutable snapshots, BIGINT minor units, transactional inventory reservations, idempotency, order events/outbox, buyer-only reads, pre-payment cancellation, and controlled expiration. It does **not** implement payments, a gateway, a financial ledger, webhooks or fulfillment. The read-only frontend consumer was subsequently implemented by PR #38.

# Incremento PR #38 — leitura frontend

Implementada e validada no CI #172, a PR #38 conecta a leitura real em `/pedidos`, o detalhe real em `/pedidos/$id` e cinco pedidos reais em `/perfil`. O módulo usa parser defensivo de respostas `unknown`, dinheiro com `BigInt`, validação centralizada de `orderCode`, correspondência entre código solicitado e retornado, paginação segura e tratamento indistinguível de 404/IDOR.

A PR permanece aberta e sem merge. Não há mutações, checkout ou pagamento nesta integração. O próximo incremento financeiro somente pode começar depois de decisão formal sobre o provedor de pagamento e deve ser entregue em PR separada.
