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

## Sprint 18.9 — Estados de pagamento (mock)

- **pending** — pagamento gerado, aguardando ação do comprador (Pix/Boleto).
- **processing** — pagamento em processamento (Cartão demo).
- **approved** — aprovado em demonstração (Saldo LIT / LIT Points).
- **rejected / cancelled / expired** — estados visuais reservados.

Ciclo alvo (backend real): `PaymentIntent` criado → webhook do PSP →
atualiza status → cria/atualiza `Order` correspondente → libera entrega.

## Sprint 18.13 — Detalhe da Venda, Chat do Pedido, Entrega e Mediação (mock)

- Pagamento aprovado (mock) formaliza a criação de uma conversa vinculada ao pedido (`order_related`), acessível em `/pedidos/$id` e em `/mensagens/$id`.
- Chat do pedido é o canal oficial para entrega, suporte e mediação. Conversa fora da plataforma reduz proteção futura.
- Entrega manual e entrega automática são exibidas de forma **visual/mockada** (nunca revelam dados reais). Cofre e criptografia reais exigem backend.
- Central de Mediação (mock) cobre motivos, provas, réplica do vendedor, timeline e trechos do chat como evidência.
- Rota `/vendedor/vendas/$id` mostra a visão do vendedor: comprador, produto, pagamento, entrega, chat, financeiro, timeline e mediação.
- Services: `sellerSaleService`, extensões em `orderService` e `messageService`; nenhum dado é persistido.
- Confirmação de recebimento, liberação de saldo, uploads reais e decisões de mediação **só podem ocorrer no backend real**.

## Sprint 18.14 — Central de Notificações (mock)

- Central visual/mockada: `notificationService` + `NotificationProvider` (`useNotifications`).
- Sino na Navbar (`NotificationBell`): dropdown no desktop, navegação para `/notificacoes` no mobile.
- Rota nova: `/notificacoes` com filtros, contagem de não lidas, marcar como lida / marcar todas / arquivar (tudo em memória).
- Notificações são geradas por papel — comprador, vendedor, admin — e cobrem pedido, pagamento, entrega, chat, mediação, vendas, KYC, denúncias, financeiro e admin.
- Notificações apontam para rotas reais quando existem (`/pedidos/$id`, `/vendedor/vendas/$id`, `/mensagens/$id`, `/admin/*`, `/lit-points`, etc.).
- **Nada é persistido**: sem LocalStorage, sem Cookies, sem backend. Push, e-mail, SMS, WebSocket e Service Worker **não** são implementados — exigem backend real, opt-in do usuário e infra de mensageria.
- Dados sensíveis nunca devem aparecer em notificações — títulos e descrições são genéricos e mascarados.
