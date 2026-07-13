# API_CONTRACTS_DRAFT.md — LIT Buy

Rascunho de endpoints sugeridos. **Não implementado.** Serve como base
para o backend futuro (REST/RPC/GraphQL/tRPC — escolha do time).

Convenção: `POST` para mutações, `GET` para leitura. Todos os endpoints
autenticados usam `Authorization: Bearer <token>` (JWT). Endpoints
`admin/*` exigem role admin.

## Auth
- `POST /auth/register` — body `{ email, password, name }`. Retorna
  usuário + envio de e-mail de verificação. Rate-limit por IP.
- `POST /auth/login` — body `{ email, password }`. Retorna sessão.
- `POST /auth/logout` — invalida token.
- `POST /auth/forgot-password` — body `{ email }`. Sempre 200
  (não vaza existência).
- `POST /auth/reset-password` — body `{ token, password }`.
- `POST /auth/verify-email` — body `{ token }`.
- `POST /auth/verify-device` — body `{ code }` para novo dispositivo.

## Users / Profile
- `GET /me` — perfil atual.
- `PATCH /me` — atualiza nome, avatar, bio.
- `GET /me/preferences` — preferências de comunicação.
- `PATCH /me/preferences` — toggle por evento/canal.
- `GET /me/wallet` — saldos.
- `POST /me/kyc` — inicia KYC (integração com provedor).

## Products
- `GET /products` — filtros: `q`, `category`, `sort`, `page`.
- `GET /products/:id` — detalhes + variações + reviews.
- `POST /products` — vendedor cria (vira `listing_draft` até aprovação).
- `PATCH /products/:id` — vendedor edita (recria draft se aprovado).
- `DELETE /products/:id` — vendedor pausa/remove.
- `GET /categories` — árvore de categorias.

## Cart
- `GET /cart` — carrinho do usuário.
- `POST /cart/items` — body `{ productId, variantId?, quantity }`.
- `PATCH /cart/items/:id` — quantidade.
- `DELETE /cart/items/:id`.
- `POST /cart/coupon` — aplica cupom.

## Checkout / Payments
- `POST /checkout` — valida carrinho, cria intent, retorna `orderId`.
- `POST /payments/pix` — retorna QR + copia-e-cola.
- `POST /payments/boleto` — retorna código + linha digitável.
- `POST /payments/card` — recebe token do gateway (nunca PAN).
- `GET /payments/:id` — status.
- `POST /payments/webhook` — **idempotente**, chamado pelo gateway.

## Orders
- `GET /orders` — pedidos do usuário.
- `GET /orders/:id` — detalhe + timeline.
- `POST /orders/:id/confirm-delivery` — libera escrow.
- `POST /orders/:id/open-mediation` — abre disputa (motivo + descrição).
- `POST /orders/:id/evidence` — upload de evidência (URL assinada).

## Messages
- `GET /conversations` — lista.
- `GET /conversations/:id` — mensagens paginadas.
- `POST /conversations/:id/messages` — envia (moderação server-side).

## Seller
- `GET /seller/dashboard` — métricas.
- `GET /seller/listings` — anúncios do vendedor.
- `POST /seller/listings` — novo (draft).
- `GET /seller/sales` — vendas.
- `GET /seller/sales/:id` — detalhe.
- `POST /seller/sales/:id/deliver` — entrega manual/automática.
- `GET /seller/team` — membros.
- `POST /seller/team/invite` — convida com token.
- `POST /seller/team/:id/role` — troca cargo.

## Wallet
- `GET /wallet` — saldos.
- `GET /wallet/transactions` — ledger paginado.
- `POST /withdrawals` — solicita saque (exige KYC aprovado).
- `GET /withdrawals` — histórico.

## Reports (denúncias)
- `POST /reports` — body `{ targetType, targetId, reason, description }`.
- `GET /reports` — reports do usuário.
- `GET /reports/:id`.
- `GET /admin/reports` — fila admin.
- `PATCH /admin/reports/:id` — moderação (accept/reject/escalate).

## Admin
- `GET /admin/dashboard` — métricas globais.
- `GET /admin/users` — search + filtros.
- `PATCH /admin/users/:id` — role, status.
- `GET /admin/orders` — pedidos globais.
- `GET /admin/audit` — logs.
- `GET /admin/reports` — denúncias.
- `PATCH /admin/reports/:id` — moderação.
- `GET /admin/kyc` — fila.
- `PATCH /admin/kyc/:id` — aprova/rejeita.

## Affiliate
- `GET /affiliate` — perfil do afiliado.
- `GET /affiliate/conversions` — lista.
- `GET /affiliate/commissions` — ledger.
- `POST /affiliate/payout-request` — saque (KYC obrigatório).

## Notifications
- `GET /notifications` — paginadas.
- `PATCH /notifications/:id/read`.
- `PATCH /notifications/read-all`.

## Emails
- `GET /admin/email-templates` — lista.
- `PATCH /admin/email-templates/:id` — edita.
- `POST /admin/email-events/test` — envia teste.

## Observações de segurança

- Todo endpoint **muta** deve ser idempotente quando possível (chave
  `Idempotency-Key`).
- Rate-limit por IP e por usuário.
- Nunca retornar tokens de outros usuários, hashes de senha, dados de
  cartão ou payloads brutos de gateway.
- Uploads: URL assinada, MIME check, tamanho máximo, antivírus.
- Todas as rotas admin/seller com **RLS + role check**.
- Webhooks: verificar assinatura, logar payload, ser idempotente.
- Logs financeiros: imutáveis, retenção mínima legal.
