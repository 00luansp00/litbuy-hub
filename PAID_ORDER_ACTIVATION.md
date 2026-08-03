# Ativação de pedidos pagos

Este incremento aplica exclusivamente a verdade financeira já persistida pelo backend:

`Payment PAID` → worker de ativação → `Order ACTIVE` → reservas `CONSUMED` → redução do estoque físico → `OrderEvent` e outbox transacionais.

## Autoridade e prazo

`Payment`, com uma única `PaymentAttempt SUCCEEDED` coerente, é a autoridade financeira. `Order.paymentStatus` é apenas uma projeção e passa a `PAID` junto com `Order.status = ACTIVE`. O worker não consulta PSP, webhook ou Efí e não realiza I/O externo.

O instante autoritativo é `Payment.paidAt`: ele deve ser anterior ou igual a `Order.expiresAt` e ao `expiresAt` de cada reserva. O horário de execução não torna um pagamento tardio. Assim, uma reserva ainda `ACTIVE`, paga no prazo, pode ser consumida mesmo que o worker rode depois do TTL. Pedidos `EXPIRED`, `CANCELLED` ou em outro estado terminal nunca são reativados.

## Estoque e atomicidade

O checkout reserva disponibilidade sem reduzir o estoque físico. A ativação transforma cada reserva necessária de `ACTIVE` em `CONSUMED` e reduz, condicionalmente, `Product.stock` para itens `NORMAL` ou `ProductVariant.stock` para itens `DYNAMIC`. Serviços `FIXED` não usam reserva.

Checkout e consumo compartilham os advisory locks `checkout-stock:product:<id>` e `checkout-stock:variant:<id>`, adquiridos em ordem determinística. Ativação, cancelamento e expiração compartilham `order:<id>`. Falta, divergência, pagamento tardio, reserva inválida ou estoque insuficiente falham de forma fechada e geram uma `ReconciliationIssue` referenciada por `OrderActivation`.

A alteração do pedido, decrementos, consumo das reservas, `ORDER_ACTIVATED`, `INVENTORY_CONSUMED` e respectivos outboxes são atômicos. Replay ou workers concorrentes não repetem efeitos.

## Fora do escopo

`fulfillmentStatus` permanece `NOT_AVAILABLE`. Ledger, reconhecimento contábil, settlement, holds, comissão, entrega e demais etapas de fulfillment permanecem para incrementos futuros.
