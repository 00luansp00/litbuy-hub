# LIT Buy — Supabase RLS Plan

Planejamento das **políticas de Row Level Security (RLS)** para quando a integração com Supabase for feita. Nenhuma política SQL deve ser criada agora — este documento serve como referência para a sprint futura.

> Toda tabela criada no schema `public` terá RLS habilitado por padrão. Ausência de política = acesso negado.

## Classificação das tabelas

### Públicas (leitura anônima permitida)
- `categories`
- `products` (apenas `status = 'active'`)
- `product_images` (apenas de produtos ativos)
- `product_reviews` (leitura pública)
- `sellers` (leitura pública dos dados de loja)
- `profiles` (leitura pública de campos públicos: username, avatar, display_name)

### Privadas (apenas dono autenticado)
- `carts` / `cart_items`
- `favorites`
- `notifications`
- `wallet_accounts`
- `withdrawals`
- `conversations` / `messages` (apenas participantes)

### Sensíveis (nunca escritas pelo cliente)
- `wallet_transactions` — somente funções `security definer` no servidor.
- `payments` — escritas apenas por webhooks verificados no servidor.
- `orders` — criação via server function; cliente lê apenas os próprios pedidos.
- `disputes` — leitura restrita às partes; alteração via server function.
- `user_roles` — leitura/escrita apenas por admins.

## Regras planejadas

### profiles
- **SELECT público** (campos públicos).
- **UPDATE:** somente o próprio usuário (`auth.uid() = id`).
- **INSERT:** trigger `on auth.users insert` cria o profile automaticamente.

### sellers
- **SELECT público.**
- **INSERT/UPDATE:** somente o próprio usuário (`auth.uid() = user_id`).

### categories
- **SELECT público.**
- **INSERT/UPDATE/DELETE:** apenas admin (`has_role(auth.uid(), 'admin')`).

### products
- **SELECT público** apenas quando `status = 'active' AND deleted_at IS NULL`.
- **SELECT do dono:** o vendedor sempre vê seus próprios produtos (independente do status).
- **INSERT/UPDATE/DELETE:** somente o vendedor dono (`seller_id` = seller do `auth.uid()`).
- **Regra extra:** admins podem moderar (via role).

### product_images
- Espelham as regras de `products`.

### product_reviews
- **SELECT público.**
- **INSERT:** somente comprador com pedido concluído do produto (validado por server function, não no cliente).
- **UPDATE/DELETE:** somente o autor, dentro de janela de tempo.

### carts / cart_items
- **Todas operações:** somente o dono (`auth.uid() = user_id` no carrinho pai).

### orders
- **SELECT comprador:** `auth.uid() = buyer_id`.
- **SELECT vendedor:** se existe `order_item` cujo `seller_id` pertence ao vendedor autenticado.
- **INSERT:** somente via server function de checkout (nunca direto do cliente).
- **UPDATE de status:** apenas server functions e webhooks.

### order_items
- Herdam a visibilidade do pedido (comprador ou vendedor envolvido).

### wallet_accounts
- **SELECT:** somente o dono.
- **INSERT:** trigger na criação do usuário.
- **UPDATE:** proibido para o cliente — apenas funções `security definer`.

### wallet_transactions
- **SELECT:** somente o dono da carteira.
- **INSERT/UPDATE/DELETE:** proibidos ao cliente. Escritas exclusivas de server functions.

### payments
- **SELECT:** comprador do pedido relacionado.
- **INSERT/UPDATE:** apenas server (webhooks verificados por assinatura).

### withdrawals
- **SELECT/INSERT:** somente o próprio usuário.
- **UPDATE de status:** somente admin/server.

### conversations / messages
- **SELECT/INSERT:** somente participantes (`buyer_id` ou `seller.user_id`) da conversa.
- **UPDATE (marcar como lida):** somente destinatário.
- **DELETE:** proibido — usar soft delete controlado.

### disputes
- **SELECT:** partes do pedido (comprador, vendedor) e admin.
- **INSERT:** partes do pedido.
- **UPDATE de status/resolução:** somente admin.

### notifications
- **SELECT/UPDATE (read_at):** somente o dono.
- **INSERT:** somente server functions.

### favorites
- **Todas operações:** somente o dono.

## Funções `security definer` previstas

- `has_role(user_id uuid, role app_role) → boolean` — checagem central de papéis (evita recursão de RLS).
- `is_order_participant(order_id uuid) → boolean`
- `is_conversation_participant(conversation_id uuid) → boolean`
- `create_order_from_cart()` — checkout atômico.
- `credit_wallet` / `debit_wallet` / `hold_funds` / `release_funds` — movimentação financeira.

## Princípios

1. **RLS é fonte da verdade de segurança.** O frontend nunca é a última linha de defesa.
2. **Grants explícitos.** Toda tabela `public.*` receberá `GRANT` para `authenticated` (e `anon` só quando aplicável) na mesma migration em que for criada.
3. **Roles fora de `profiles`.** Papéis vivem em `user_roles`, checados via `has_role`.
4. **Movimentações financeiras jamais escritas pelo cliente.** Sempre via função `security definer` com auditoria.
5. **Webhooks isolados.** Endpoints públicos ficam em `/api/public/*` e validam assinatura antes de qualquer INSERT.

## Reforços de RLS por regra de marketplace (Sprint 18.2)

- **Comprador só vê os próprios pedidos** — `orders` SELECT: `buyer_id = auth.uid()`.
- **Vendedor só vê pedidos dos seus produtos** — `order_items` SELECT: `seller_id = auth.uid()`; `orders` visíveis via join server-side, nunca listagem direta.
- **Admin vê tudo conforme permissão** — `public.has_role(auth.uid(), 'admin')` em policies dedicadas; nunca coluna booleana em `profiles`.
- **Mensagens só para participantes** — `messages` SELECT: `auth.uid() in (conversation.buyer_id, conversation.seller_id)`; admin lê apenas conversas vinculadas a disputa/denúncia via server function.
- **Disputas só para partes envolvidas e admin** — `disputes` SELECT: `buyer_id`, `seller_id` ou `has_role('admin')`.
- **Carteira só para o dono** — `wallet_accounts`, `withdrawals` SELECT: `user_id = auth.uid()`; `wallet_transactions` leitura via server function.
- **Audit logs imutáveis** — sem INSERT/UPDATE/DELETE por qualquer usuário; escrita só via `security definer` server-side.
- **Status financeiros não são alterados pelo frontend** — `orders.status`, `disputes.status`, `wallet_transactions.*` sem policy de UPDATE para roles `authenticated`/`anon`; mutações via server functions verificadas.
