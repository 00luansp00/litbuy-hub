# LIT Buy — Entity Relationship

Visão de alto nível dos relacionamentos entre entidades do marketplace. Complementa `DATABASE_SCHEMA.md` e serve como referência conceitual para desenvolvedores(as) que forem implementar as integrações futuras.

> Nenhuma tabela existe hoje. Este documento descreve a **intenção** da modelagem.

## Diagrama textual

```
auth.users ──1:1── users ──1:1── profiles
                    │
                    ├──1:1── sellers ──1:N── products ──N:1── categories
                    │                             │
                    │                             ├──1:N── product_images
                    │                             └──1:N── product_reviews
                    │
                    ├──1:1── carts ──1:N── cart_items ──N:1── products
                    │
                    ├──1:N── orders ──1:N── order_items ──N:1── products
                    │           │                └──N:1── sellers
                    │           ├──1:N── payments
                    │           └──1:N── disputes
                    │
                    ├──1:1── wallet_accounts ──1:N── wallet_transactions
                    ├──1:N── withdrawals
                    ├──1:N── favorites ──N:1── products
                    ├──1:N── notifications
                    └──1:N── conversations ──1:N── messages
```

## Relacionamentos principais

### Usuário e identidade

- Todo **usuário** (`users`) corresponde a exatamente um registro em `auth.users` do Supabase.
- Todo usuário possui exatamente um **profile** (dados públicos/pessoais).
- Um usuário **pode** também ser **vendedor** — nesse caso existe um registro em `sellers` associado.

### Catálogo

- Cada **vendedor** possui vários **produtos**.
- Cada **produto** pertence a exatamente uma **categoria**.
- Categorias podem ter subcategorias (auto-referência via `parent_id`).
- Um produto possui várias **imagens** (`product_images`).
- Um produto acumula várias **reviews** (`product_reviews`), sempre vinculadas a um pedido concluído.

### Carrinho e pedidos

- Cada usuário possui **um único carrinho** persistente.
- Um carrinho contém vários **itens de carrinho**; cada item aponta para um produto.
- Ao finalizar compra, o carrinho gera um **pedido** (`orders`) do comprador.
- Um pedido possui vários **itens de pedido** (`order_items`).
- Cada item de pedido referencia o **produto** original e o **vendedor** responsável (para split, RLS e dashboards).
- Um pedido pode ter vários **payments** (tentativas / retries).
- Um pedido pode gerar uma ou mais **disputes**.

### Carteira e financeiro

- Cada usuário possui uma **wallet_account** (carteira interna).
- Toda movimentação passa por **wallet_transactions** — imutáveis, escritas apenas por lógica server-side.
- **Withdrawals** representam pedidos de saque feitos pelo usuário.
- O frontend nunca altera saldo diretamente; sempre solicita operações que geram transações.

### Comunicação

- **Conversations** conectam um comprador (`users`) e um vendedor (`sellers`), opcionalmente contextualizadas por produto ou pedido.
- **Messages** pertencem a uma conversa; apenas os participantes podem ler ou escrever.
- **Disputes** pertencem a um pedido e envolvem comprador, vendedor e (quando escalado) administração.

### Engajamento

- **Favorites** conectam usuários a produtos (relação N:N).
- **Notifications** são notificações individuais por usuário, com deep-link para rotas internas.

## Regras conceituais importantes

1. **Comprador ≠ Vendedor no mesmo pedido.** Um usuário não pode comprar um item do próprio catálogo (regra de negócio + RLS futura).
2. **Preço snapshot.** `order_items.unit_price` e `cart_items.unit_price` guardam o preço no momento da adição — nunca recalcular a partir do produto atual.
3. **Denormalização controlada.** `products.rating`, `products.reviews_count`, `sellers.rating`, `sellers.sales_count`, `wallet_accounts.balance` são calculados por triggers ou funções — o cliente apenas lê.
4. **Roles em tabela separada.** Papéis (admin, moderador, seller_verified) NÃO ficam em `profiles`; ficam em `user_roles` (a ser detalhada). Isso previne escalação de privilégio.
5. **Soft delete.** Produtos, pedidos e mensagens removidos são marcados via `deleted_at`; nunca deletados fisicamente para preservar histórico financeiro.
6. **Auditoria financeira.** Toda alteração de saldo produz uma linha em `wallet_transactions`. Nunca há UPDATE do saldo sem transação correspondente.

## Relacionamentos-chave (Sprint 18.2)

Reforços conceituais alinhados a `MARKETPLACE_RULES.md`:

- **user compra e vende** — não há entidade separada de comprador/vendedor; a mesma `user` origina `orders` e detém `sellers`/`products`.
- **user pode ter seller profile público** — `sellers` 1:1 opcional com `users`, expondo `/loja/$slug`.
- **order pertence ao buyer** — `orders.buyer_id → users.id`.
- **order_item referencia product e seller** — `order_items.product_id`, `order_items.seller_id` (denormalizado no momento da compra para preservar histórico).
- **review referencia order_item** — `product_reviews.order_item_id` (obrigatório, único).
- **dispute referencia order** — `disputes.order_id` (uma disputa aberta por vez por pedido).
- **wallet pertence ao user** — `wallet_accounts.user_id` 1:1.
- **transaction referencia wallet** — `wallet_transactions.wallet_id`, com `order_id`/`dispute_id` opcionais.
- **conversation pode referenciar order** — `conversations.order_id nullable`.
- **admin actions geram audit log** — toda mutação administrativa produz linha em `admin_audit_logs`.

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

## Persistent Listing Draft Foundation (2026-07-19)

Real: rascunhos persistentes de anúncio, edição, submissão, fila administrativa, início de análise, rejeição, correção/reenvio, aprovação de moderação, `expectedVersion`, validação pela taxonomia real e auditoria em `SecurityEvent`.

Futuro/demonstrativo: aprovação não publica produto público; imagens permanecem previews locais sem upload/storage; cofre, credenciais, entrega automática real, planos pagos, pagamentos, compras e KYC não foram implementados. Ver `LISTING_DRAFT_FOUNDATION.md`.
