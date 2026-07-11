# ORDER_LIFECYCLE.md — LIT Buy

Ciclo de vida futuro de pedidos. **Documentação de planejamento** — não implementado. Nenhum status abaixo existe no frontend hoje.

## Status

### `pending_payment`
- **Significado:** pedido criado, aguardando confirmação de pagamento pelo gateway.
- **Quem vê:** comprador, admin.
- **Quem age:** comprador (paga ou cancela); sistema (webhook do gateway).
- **Próxima transição:** `paid` (webhook OK) ou `cancelled` (timeout/cancelamento).
- **Segurança:** vendedor **não** deve ver pedido antes de `paid`.

### `paid`
- **Significado:** pagamento confirmado pelo gateway, valor em escrow na plataforma.
- **Quem vê:** comprador, vendedor, admin.
- **Quem age:** sistema (transição automática para `awaiting_seller_delivery`).
- **Próxima transição:** `awaiting_seller_delivery`.
- **Segurança:** transição só pode ser feita via webhook verificado, nunca pelo frontend.

### `awaiting_seller_delivery`
- **Significado:** aguardando vendedor entregar produto digital.
- **Quem vê:** comprador, vendedor, admin.
- **Quem age:** vendedor (entrega); comprador (pode abrir disputa após SLA).
- **Próxima transição:** `delivered_by_seller` ou `disputed`.
- **Segurança:** SLA de entrega deve ser aplicado pelo backend.

### `delivered_by_seller`
- **Significado:** vendedor confirmou entrega e forneceu dados/instruções/código.
- **Quem vê:** comprador, vendedor, admin.
- **Quem age:** comprador (confirma ou abre disputa).
- **Próxima transição:** `awaiting_buyer_confirmation`.
- **Segurança:** evidência de entrega deve ser persistida (ver `DIGITAL_DELIVERY_FLOW.md`).

### `awaiting_buyer_confirmation`
- **Significado:** comprador tem prazo para confirmar recebimento.
- **Quem vê:** comprador, vendedor, admin.
- **Quem age:** comprador (confirma ou disputa); sistema (auto-confirma após prazo).
- **Próxima transição:** `completed` ou `disputed`.
- **Segurança:** auto-confirmação deve ser via job de backend, não frontend.

### `completed`
- **Significado:** pedido concluído com sucesso. Saldo do vendedor entra no ciclo de liberação (ver `WALLET_AND_ESCROW_RULES.md`).
- **Quem vê:** comprador, vendedor, admin.
- **Quem age:** comprador (pode avaliar — ver `REVIEW_RULES.md`).
- **Próxima transição:** nenhuma (terminal), exceto `disputed` dentro de janela pós-venda.
- **Segurança:** liberação de saldo é decisão de servidor.

### `cancelled`
- **Significado:** pedido cancelado antes do pagamento ou por acordo.
- **Quem vê:** comprador, admin. Vendedor só se já era visível.
- **Quem age:** ninguém (terminal).
- **Próxima transição:** nenhuma.
- **Segurança:** cancelamento pós-pagamento vira `refunded`, não `cancelled`.

### `disputed`
- **Significado:** disputa aberta. Saldo bloqueado. Ver `DISPUTE_FLOW.md`.
- **Quem vê:** comprador, vendedor, admin.
- **Quem age:** comprador, vendedor, admin (dentro do fluxo de disputa).
- **Próxima transição:** `completed`, `refunded` ou permanece `disputed` até resolução.
- **Segurança:** transição só via decisão registrada (admin ou acordo).

### `refunded`
- **Significado:** valor devolvido ao comprador (total ou parcial).
- **Quem vê:** comprador, vendedor, admin.
- **Quem age:** ninguém (terminal).
- **Próxima transição:** nenhuma.
- **Segurança:** reembolso executado via gateway, com transação registrada.

## Nota

Hoje, o frontend usa status simplificados nos mocks (`SellerOrder.status`, etc.) que **não** correspondem 1:1 a esta lista. Esta é a **especificação-alvo** para a implementação real com backend.
