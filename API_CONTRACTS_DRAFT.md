# API_CONTRACTS_DRAFT.md — LIT Buy

Rascunho de endpoints sugeridos. **Não implementado.** Serve como base
para o backend futuro (REST/RPC/GraphQL/tRPC — escolha do time).

Convenção: `POST` para mutações, `GET` para leitura. Todos os endpoints
autenticados usam `Authorization: Bearer <token>` (JWT). Endpoints
`admin/*` exigem role admin.

## Auth

O contrato real de autenticação está documentado em `AUTHENTICATION_FINAL_AUDIT.md` e nos DTOs/controller do backend (`backend/src/auth/dto.ts` e `backend/src/auth/auth.controller.ts`). Os contratos abaixo dos demais domínios são propostas históricas e não representam APIs implementadas.

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

## Contrato real de autenticação — consolidado em 2026-07-17

O contrato real implementado para autenticação está documentado em `AUTHENTICATION_FINAL_AUDIT.md` e substitui o rascunho antigo desta seção para endpoints `/auth/*`. Não inferir contratos de pagamentos, pedidos, seller, admin, KYC ou wallet a partir do bloco de autenticação.

## Marketplace RBAC foundation update

The marketplace authorization foundation is now persistent: `BUYER`, `SELLER` and `ADMIN` live in the backend database, `/auth/me` returns real lowercase roles, and the frontend derives `isAdmin`/`hasSellerAccess` only from that response. Demo role flags no longer grant access. Seller/admin page content remains mock-oriented; only gates and future server-side authorization primitives were added. See `MARKETPLACE_RBAC_FOUNDATION.md`.

## Seller onboarding foundation (2026-07-18)

- Adicionado onboarding real de vendedor sem KYC externo: solicitação persistida, análise administrativa, aprovação/rejeição, criação de perfil inicial e concessão atômica do papel `SELLER`.
- Novos modelos: `SellerApplication` e `SellerProfile`; `SellerProfile.verified` nasce `false` e não representa KYC.
- Produtos, anúncios, vendas, financeiro, reputação, wallet, saques, documentos, selfie e verificação externa continuam mockados ou pendentes para sprints futuras.
- Fornecedor de KYC permanece não escolhido (`NOT_ANALYZED`); nenhum documento real deve ser enviado.
- Consulte `SELLER_ONBOARDING_FOUNDATION.md` para escopo, endpoints, estados e limitações.

## Catalog taxonomy foundation update

Persistent catalog taxonomy is now the source of truth for categories, subcategories, product types, attributes, ordering, active/inactive status and category featured flags. Public consumers use active entities only, and `/admin/catalogo` uses protected administrative endpoints. Products, listings, prices, images, stock, seller metrics, reviews, search, promotions, seller plans and publishing remain demonstrative/mock and must not be treated as real commercial catalog data.

### Catalog subcategory public contract

`GET /api/v1/catalog/categories/:slug/subcategories` returns a minimal public contract: `id`, `slug`, `name` and `sortOrder`. It intentionally omits `categoryId`, `status`, timestamps, administrative metadata and all fictitious metrics because the category is already provided by the URL context.

## Persistent Listing Draft Foundation (2026-07-19)

Real: rascunhos persistentes de anúncio, edição, submissão, fila administrativa, início de análise, rejeição, correção/reenvio, aprovação de moderação, `expectedVersion`, validação pela taxonomia real e auditoria em `SecurityEvent`.

Futuro/demonstrativo: aprovação não publica produto público; imagens permanecem previews locais sem upload/storage; cofre, credenciais, entrega automática real, planos pagos, pagamentos, compras e KYC não foram implementados. Ver `LISTING_DRAFT_FOUNDATION.md`.

## Internal product endpoints

- `GET /api/v1/seller/products` e `GET /api/v1/seller/products/:id`: requerem `SELLER` e escopam pelo `SellerProfile` autenticado.
- `GET /api/v1/admin/products` e `GET /api/v1/admin/products/:id`: requerem `ADMIN`.
- A aprovação de rascunho inclui `materializedProduct: { id, slug, status }` quando o produto existe; status inicial é sempre `UNPUBLISHED`.
