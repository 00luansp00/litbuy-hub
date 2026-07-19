# LIT Buy — Database Schema (Planejamento)

Documento técnico descrevendo a **modelagem futura** do banco de dados da LIT Buy. Nenhuma tabela existe hoje — a aplicação usa mocks em `src/data/` acessados via `src/services/`. Este arquivo serve como referência para a sprint futura de integração com Supabase.

> ⚠️ Nenhum SQL deve ser executado agora. Este documento é apenas contrato técnico.

## Convenções gerais

- **PK padrão:** `id uuid primary key default gen_random_uuid()`.
- **Timestamps:** todas as tabelas terão `created_at timestamptz default now()` e, quando fizer sentido, `updated_at timestamptz`.
- **Soft delete:** tabelas sensíveis (`products`, `orders`, `messages`) terão `deleted_at timestamptz`.
- **Moeda:** valores monetários em `numeric(12,2)` — nunca `float`.
- **Enums:** representados como `text` com `check` ou como tipos `enum` dedicados quando estáveis.
- **Auth:** `users` referencia `auth.users(id)` do Supabase; nunca duplicar credenciais.
- **Roles:** armazenados em tabela separada (`user_roles`) — nunca em `profiles`.

---

## 1. users

**Objetivo:** espelho mínimo de `auth.users` para joins internos.

| Campo      | Tipo        | Observações                             |
| ---------- | ----------- | --------------------------------------- |
| id         | uuid (PK)   | FK → `auth.users(id)` on delete cascade |
| email      | text unique | Sincronizado via trigger                |
| created_at | timestamptz |                                         |

**Relacionamentos:** 1–1 com `profiles`, 1–1 com `wallet_accounts`, 1–N com `orders`, `favorites`, `notifications`.

---

## 2. profiles

**Objetivo:** dados públicos/pessoais do usuário.

| Campo        | Tipo        | Observações  |
| ------------ | ----------- | ------------ |
| id           | uuid (PK)   | = `users.id` |
| username     | text unique | Slug público |
| display_name | text        |              |
| avatar_url   | text        |              |
| bio          | text        |              |
| country      | text        | ISO-3166     |
| created_at   | timestamptz |              |
| updated_at   | timestamptz |              |

**Relacionamentos:** 1–1 com `users`.

---

## 3. sellers

**Objetivo:** dados adicionais quando um usuário atua como vendedor.

| Campo             | Tipo         | Observações                       |
| ----------------- | ------------ | --------------------------------- |
| id                | uuid (PK)    |                                   |
| user_id           | uuid unique  | FK → `users(id)`                  |
| store_name        | text         | Nome público da loja              |
| store_slug        | text unique  |                                   |
| level             | text         | novato / prata / ouro / diamante  |
| rating            | numeric(3,2) | Agregado (0.00–5.00)              |
| sales_count       | int          | Denormalizado para leitura rápida |
| response_time_min | int          | Tempo médio em minutos            |
| verified          | boolean      | Vendedor verificado pela LIT      |
| member_since      | timestamptz  |                                   |

**Relacionamentos:** 1–N com `products`.

---

## 4. categories

**Objetivo:** taxonomia do marketplace.

| Campo       | Tipo        | Observações                        |
| ----------- | ----------- | ---------------------------------- |
| id          | uuid (PK)   |                                    |
| slug        | text unique |                                    |
| name        | text        |                                    |
| icon        | text        | Nome do ícone lucide               |
| description | text        |                                    |
| color       | text        | Token/hex de destaque              |
| parent_id   | uuid null   | FK → `categories(id)` (hierarquia) |
| sort_order  | int         |                                    |

**Relacionamentos:** 1–N com `products`; auto-referência opcional.

---

## 5. products

**Objetivo:** anúncios ativos do marketplace.

| Campo            | Tipo          | Observações                       |
| ---------------- | ------------- | --------------------------------- |
| id               | uuid (PK)     |                                   |
| slug             | text unique   |                                   |
| seller_id        | uuid          | FK → `sellers(id)`                |
| category_id      | uuid          | FK → `categories(id)`             |
| title            | text          |                                   |
| description      | text          | Markdown                          |
| price            | numeric(12,2) |                                   |
| original_price   | numeric(12,2) | Para exibir desconto              |
| stock            | int           |                                   |
| instant_delivery | boolean       |                                   |
| trust_score      | int           | 0–100                             |
| status           | text          | draft / active / paused / removed |
| badge            | text          | hot / new / promo / top           |
| best_seller      | boolean       |                                   |
| rating           | numeric(3,2)  | Agregado                          |
| reviews_count    | int           | Denormalizado                     |
| sold_count       | int           | Denormalizado                     |
| created_at       | timestamptz   |                                   |
| updated_at       | timestamptz   |                                   |
| deleted_at       | timestamptz   | Soft delete                       |

**Observações:** somente produtos com `status = 'active'` são públicos (ver RLS).

---

## 6. product_images

**Objetivo:** múltiplas imagens por produto.

| Campo      | Tipo      | Observações                 |
| ---------- | --------- | --------------------------- |
| id         | uuid (PK) |                             |
| product_id | uuid      | FK → `products(id)` cascade |
| url        | text      |                             |
| alt        | text      |                             |
| sort_order | int       | Miniatura = menor           |
| is_cover   | boolean   |                             |

---

## 7. product_reviews

**Objetivo:** avaliações do comprador após pedido concluído.

| Campo      | Tipo        | Observações                        |
| ---------- | ----------- | ---------------------------------- |
| id         | uuid (PK)   |                                    |
| product_id | uuid        | FK → `products(id)`                |
| order_id   | uuid        | FK → `orders(id)` (garante compra) |
| author_id  | uuid        | FK → `users(id)`                   |
| rating     | int         | 1–5 check                          |
| comment    | text        |                                    |
| created_at | timestamptz |                                    |

**Regras:** uma review por `(order_id, product_id)`. Trigger atualiza `products.rating` e `reviews_count`.

---

## 8. carts

**Objetivo:** carrinho persistente por usuário.

| Campo      | Tipo        | Observações      |
| ---------- | ----------- | ---------------- |
| id         | uuid (PK)   |                  |
| user_id    | uuid unique | FK → `users(id)` |
| updated_at | timestamptz |                  |

---

## 9. cart_items

| Campo      | Tipo          | Observações              |
| ---------- | ------------- | ------------------------ |
| id         | uuid (PK)     |                          |
| cart_id    | uuid          | FK → `carts(id)` cascade |
| product_id | uuid          | FK → `products(id)`      |
| quantity   | int           | check > 0                |
| unit_price | numeric(12,2) | Snapshot do preço        |
| added_at   | timestamptz   |                          |

**Único:** `(cart_id, product_id)`.

---

## 10. orders

**Objetivo:** pedidos confirmados.

| Campo          | Tipo          | Observações                                       |
| -------------- | ------------- | ------------------------------------------------- |
| id             | uuid (PK)     |                                                   |
| buyer_id       | uuid          | FK → `users(id)`                                  |
| status         | text          | pending / paid / delivered / disputed / cancelled |
| subtotal       | numeric(12,2) |                                                   |
| fees           | numeric(12,2) |                                                   |
| total          | numeric(12,2) |                                                   |
| payment_method | text          | wallet / card / pix                               |
| created_at     | timestamptz   |                                                   |
| paid_at        | timestamptz   |                                                   |
| delivered_at   | timestamptz   |                                                   |

---

## 11. order_items

| Campo         | Tipo          | Observações                            |
| ------------- | ------------- | -------------------------------------- |
| id            | uuid (PK)     |                                        |
| order_id      | uuid          | FK → `orders(id)` cascade              |
| product_id    | uuid          | FK → `products(id)` (restrict)         |
| seller_id     | uuid          | FK → `sellers(id)` (para split e RLS)  |
| quantity      | int           |                                        |
| unit_price    | numeric(12,2) | Snapshot                               |
| delivery_data | jsonb         | Cópia entregável (chave, código, etc.) |

---

## 12. wallet_accounts

**Objetivo:** carteira interna por usuário.

| Campo      | Tipo          | Observações              |
| ---------- | ------------- | ------------------------ |
| id         | uuid (PK)     |                          |
| user_id    | uuid unique   | FK → `users(id)`         |
| balance    | numeric(12,2) | Calculado por transações |
| currency   | text          | Default 'BRL'            |
| updated_at | timestamptz   |                          |

**Regra:** o saldo NUNCA é atualizado pelo cliente; apenas via funções server-side.

---

## 13. wallet_transactions

| Campo         | Tipo          | Observações                                 |
| ------------- | ------------- | ------------------------------------------- |
| id            | uuid (PK)     |                                             |
| wallet_id     | uuid          | FK → `wallet_accounts(id)`                  |
| type          | text          | credit / debit / hold / release / fee       |
| amount        | numeric(12,2) | Sempre positivo; sinal vem do `type`        |
| balance_after | numeric(12,2) | Snapshot pós-transação                      |
| reference     | text          | order:{id} / payment:{id} / withdrawal:{id} |
| created_at    | timestamptz   |                                             |

**Imutável:** sem UPDATE/DELETE via API pública.

---

## 14. payments

**Objetivo:** tentativas e resultados de pagamento externo.

| Campo        | Tipo          | Observações                             |
| ------------ | ------------- | --------------------------------------- |
| id           | uuid (PK)     |                                         |
| order_id     | uuid          | FK → `orders(id)`                       |
| provider     | text          | stripe / mercadopago / pix              |
| provider_ref | text          | ID externo                              |
| amount       | numeric(12,2) |                                         |
| status       | text          | pending / succeeded / failed / refunded |
| raw_payload  | jsonb         | Webhook cru para auditoria              |
| created_at   | timestamptz   |                                         |

---

## 15. withdrawals

**Objetivo:** saques do vendedor.

| Campo        | Tipo          | Observações                            |
| ------------ | ------------- | -------------------------------------- |
| id           | uuid (PK)     |                                        |
| user_id      | uuid          | FK → `users(id)`                       |
| amount       | numeric(12,2) |                                        |
| method       | text          | pix / bank_transfer                    |
| destination  | jsonb         | Dados do destino (mascarados na UI)    |
| status       | text          | requested / approved / paid / rejected |
| requested_at | timestamptz   |                                        |
| processed_at | timestamptz   |                                        |

---

## 16. conversations

**Objetivo:** thread entre comprador e vendedor.

| Campo           | Tipo        | Observações        |
| --------------- | ----------- | ------------------ |
| id              | uuid (PK)   |                    |
| buyer_id        | uuid        | FK → `users(id)`   |
| seller_id       | uuid        | FK → `sellers(id)` |
| product_id      | uuid null   | Contexto opcional  |
| order_id        | uuid null   | Contexto opcional  |
| last_message_at | timestamptz |                    |

**Único:** `(buyer_id, seller_id, product_id)` quando `product_id` é definido.

---

## 17. messages

| Campo           | Tipo        | Observações                      |
| --------------- | ----------- | -------------------------------- |
| id              | uuid (PK)   |                                  |
| conversation_id | uuid        | FK → `conversations(id)` cascade |
| sender_id       | uuid        | FK → `users(id)`                 |
| body            | text        |                                  |
| attachments     | jsonb       | URLs assinadas                   |
| read_at         | timestamptz |                                  |
| created_at      | timestamptz |                                  |

---

## 18. disputes

**Objetivo:** disputas abertas em pedidos.

| Campo       | Tipo        | Observações                                                                |
| ----------- | ----------- | -------------------------------------------------------------------------- |
| id          | uuid (PK)   |                                                                            |
| order_id    | uuid        | FK → `orders(id)`                                                          |
| opened_by   | uuid        | FK → `users(id)`                                                           |
| reason      | text        |                                                                            |
| status      | text        | open / awaiting_seller / awaiting_buyer / resolved_buyer / resolved_seller |
| resolution  | text        |                                                                            |
| created_at  | timestamptz |                                                                            |
| resolved_at | timestamptz |                                                                            |

---

## 19. notifications

| Campo      | Tipo        | Observações                                 |
| ---------- | ----------- | ------------------------------------------- |
| id         | uuid (PK)   |                                             |
| user_id    | uuid        | FK → `users(id)`                            |
| type       | text        | order / message / dispute / wallet / system |
| title      | text        |                                             |
| body       | text        |                                             |
| link       | text        | Rota interna                                |
| read_at    | timestamptz |                                             |
| created_at | timestamptz |                                             |

---

## 20. favorites

| Campo      | Tipo        | Observações                       |
| ---------- | ----------- | --------------------------------- |
| user_id    | uuid        | FK → `users(id)` (PK composta)    |
| product_id | uuid        | FK → `products(id)` (PK composta) |
| created_at | timestamptz |                                   |

**PK composta:** `(user_id, product_id)`.

---

## Índices sugeridos (futuro)

- `products (category_id, status)` — listagem por categoria
- `products (seller_id, status)`
- `order_items (seller_id)` — dashboard vendedor
- `messages (conversation_id, created_at desc)`
- `wallet_transactions (wallet_id, created_at desc)`
- `notifications (user_id, read_at)`

## Tabelas auxiliares fora deste escopo

`user_roles`, `audit_logs`, `feature_flags`, `email_events` — serão detalhadas em sprints posteriores.

---

## Cobertura das regras de marketplace (Sprint 18.2)

Verificação documental de que o schema previsto acobera as regras registradas em `MARKETPLACE_RULES.md` e documentos relacionados:

- **Order status** — `orders.status` cobre o ciclo de `ORDER_LIFECYCLE.md` (`pending_payment` → `refunded`).
- **Delivery status** — prever `order_items.delivery_status` (`pending`, `delivered`, `confirmed`, `auto_confirmed`) + `order_item_deliveries` (payload, hash, timestamp, evidências). Ver `DIGITAL_DELIVERY_FLOW.md`.
- **Dispute status** — `disputes.status` cobre os estados de `DISPUTE_FLOW.md` (`open`, `waiting_buyer`, `waiting_seller`, `under_review`, `resolved_buyer`, `resolved_seller`, `closed`).
- **Wallet pending/available/blocked balance** — derivados do ledger `wallet_transactions` (nunca colunas mutáveis diretas); views agregam por estado (`pending`, `available`, `blocked`).
- **Listing status** — `products.status` cobre `LISTING_STATUS_RULES.md` (`draft`, `pending_review`, `active`, `paused`, `rejected`, `sold_out`, `removed`).
- **Reviews ligadas a pedido** — `product_reviews.order_item_id` obrigatório e único; ver `REVIEW_RULES.md`.
- **Conversations ligadas a pedido opcionalmente** — `conversations.order_id nullable` para permitir pré-compra.
- **Admin audit logs** — tabela `admin_audit_logs` (actor_id, action, target_type, target_id, payload jsonb, created_at) imutável; escrita apenas via server function; leitura restrita a admins.

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
