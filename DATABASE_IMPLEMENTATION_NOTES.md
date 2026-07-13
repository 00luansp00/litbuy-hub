# DATABASE_IMPLEMENTATION_NOTES.md — LIT Buy

Complemento de `DATABASE_SCHEMA.md` e `SUPABASE_RLS_PLAN.md`.
Notas de implementação para o backend futuro.

## Convenções gerais
- Todas as tabelas em `public`.
- Chaves primárias `uuid` com `gen_random_uuid()`.
- Timestamps `created_at`, `updated_at` com trigger `handle_updated_at`.
- Nomes em `snake_case`, singular ou plural (padronizar por
  convenção do time — recomendado plural).
- **GRANT explícito** para `authenticated` / `anon` / `service_role`
  em toda tabela em `public`.
- **RLS habilitado** em toda tabela pública.
- Roles em tabela separada (`user_roles`) + função
  `has_role(uuid, app_role)` security definer.

## Tabelas críticas

### users / profiles
- `auth.users` gerenciado pelo Supabase Auth.
- `profiles`: dados públicos (nome, avatar, bio, seller flag).
- RLS: user vê o próprio, admin vê tudo.

### sellers
- Estende profile com dados de vendedor (loja slug, nível, KYC status).
- RLS: público lê perfis ativos; owner atualiza.

### seller_team_members
- `seller_id`, `user_id`, `role` (owner/manager/staff), `status`.
- RLS: apenas owner do seller lista/edita.
- **Auditoria** obrigatória.

### categories / subcategories
- Árvore com `parent_id`.
- RLS: `SELECT` público; admin escreve.

### products
- Snapshot de preço, status (`draft`, `pending`, `active`, `paused`,
  `blocked`), estoque, tipo (`normal`/`dynamic`/`service`).
- Índices: `(status, category_id)`, `(seller_id, status)`, full-text
  em `title`/`description`.
- RLS: público lê `active`; owner lê tudo próprio; admin lê tudo.

### product_variants / product_images
- Variants: preço/estoque próprios.
- Images: `storage_path` (bucket privado) + `is_primary`.
- RLS: seguem o produto pai.

### listing_drafts
- Rascunhos do wizard. TTL para expirar (`created_at + interval '30 days'`).

### orders / order_items
- `orders`: status (`pending_payment`, `paid`, `in_delivery`,
  `delivered`, `completed`, `disputed`, `refunded`, `canceled`).
- `order_items`: snapshot de produto (preço, título, imagem).
- **Trigger** para transições válidas.
- **Auditoria** obrigatória.
- Índices: `(user_id, created_at)`, `(seller_id, status)`.

### payments
- `provider`, `provider_id`, `method` (pix/boleto/card), `status`,
  `amount`, `fee`, `net`, `idempotency_key UNIQUE`.
- **Nunca** armazenar PAN, CVV ou chave Pix.
- Webhook idempotente via `idempotency_key`.

### wallet_accounts / wallet_transactions
- Ledger append-only. `wallet_transactions` NUNCA é atualizado ou
  deletado — apenas insert.
- Saldos derivados por view materializada + reconciliação diária.
- Buckets: `available`, `pending`, `held`, `frozen`.
- **Criptografia em repouso** (Postgres pgcrypto para campos
  sensíveis) ou provedor externo.

### withdrawals
- `status` (`requested`, `kyc_review`, `approved`, `paid`, `rejected`).
- Exige KYC aprovado.
- **Auditoria** + logs financeiros.

### conversations / messages
- `messages` com `sanitized_content` (LIT-MAX).
- RLS: participantes leem/escrevem.
- Índice `(conversation_id, created_at)`.
- Retenção mínima definida por LGPD/termos.

### mediation_cases
- Vinculado a `order_id`. Status + prazo + evidências.
- Admin resolve; audit log em cada transição.

### reports (denúncias)
- `target_type` (product/store/message/order/sale), `target_id`,
  `reason`, `description`, `severity`, `status`.
- RLS: reporter vê o próprio; admin vê tudo.
- Evidências em bucket privado com URL assinada.

### reviews
- `order_id UNIQUE` para evitar duplicata.
- Moderação server-side.

### notifications
- `user_id`, `type`, `payload jsonb`, `read_at`.
- Retenção: 90 dias sugerido.

### email_preferences / email_templates
- Preferências por `event_key` + canal.
- Templates versionados (`version` incremental).
- Auditar mudança de template.

### affiliate_profiles / affiliate_conversions
- `affiliate_conversions` append-only (ledger).
- Antifraude: score, self-referral check.

### audit_logs / admin_actions
- Append-only. **Nunca** deletar/atualizar.
- `actor_id`, `action`, `target_type`, `target_id`, `metadata jsonb`,
  `ip`, `user_agent`, `created_at`.
- Retenção mínima legal (7 anos para financeiro).

### kyc_verifications
- Referência ao provedor externo (nunca armazenar documento cru).
- Status + score + timestamps.
- Criptografia + acesso restrito ao admin.

## Requisitos gerais

- **RLS**: obrigatória em toda tabela pública. Ver
  `SUPABASE_RLS_PLAN.md`.
- **Constraints**: `CHECK` para status/enum, `UNIQUE` para chaves
  de idempotência, `FK` com `ON DELETE` explícito.
- **Triggers**: `handle_updated_at`, transições de estado,
  auditoria automática.
- **Índices**: em toda coluna usada em WHERE/ORDER frequente.
- **Idempotência**: pagamentos e webhooks via `idempotency_key`.
- **Transações**: usar `BEGIN`/`COMMIT` em fluxos multi-tabela
  (checkout, entrega, mediação).
- **Backups**: automáticos diários + teste de restore mensal.
- **Retenção**: definida por área (financeiro 7 anos,
  mensagens 2 anos, logs de auditoria 5+ anos, notificações 90 dias).
- **LGPD**: exportação e apagamento por usuário (endpoints dedicados).
- **Criptografia**: em repouso para PII, KYC, dados financeiros
  sensíveis. TLS 1.2+ em trânsito.

## Nunca no frontend
- Cálculo final de preço, taxa, comissão, saldo.
- Autorização (roles, permissões).
- Validação de KYC.
- Emissão/validação de token.
- Regras de mediação, prazo, escrow.
- Antifraude.
