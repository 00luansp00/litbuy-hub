# BACKEND_ROADMAP.md — LIT Buy

Roadmap recomendado para transformar o MVP visual em produto real.
Stack assumida: **Supabase** (Postgres + Auth + Storage + Realtime +
Edge Functions), TanStack Start como frontend.

## Fase 1 — Fundação técnica (dev experiente obrigatório)

- Escolher backend (Supabase recomendado — ver `SUPABASE_RLS_PLAN.md`).
- Configurar banco Postgres + migrations.
- Autenticação: Supabase Auth (e-mail + OAuth futuro).
- Modelo `users` + `profiles`.
- Papéis (roles) em tabela separada + `has_role()` security definer.
- **RLS obrigatório** em todas as tabelas públicas.
- Logs de auditoria (`audit_logs` append-only).
- Storage buckets (produtos, KYC, evidências, cofre).
- Variáveis de ambiente + secrets (LOVABLE_API_KEY, gateway keys).

## Fase 2 — Catálogo

- `categories`, `subcategories`, `products`, `product_variants`,
  `product_images`.
- Aprovação admin (`listing_drafts` → `products`).
- Estoque com constraints + reserva atômica no checkout.
- Busca (Postgres FTS ou Meilisearch/Typesense).

## Fase 3 — Comprador

- Cart server-side idempotente.
- Favoritos persistidos.
- `orders`, `order_items`, timeline.
- Reviews com antifraude.
- Mensagens realtime.

## Fase 4 — Vendedor

- Painel vendedor real (queries agregadas).
- Vendas + entrega manual (anexo assinado).
- Entrega automática (cofre) com storage seguro + auditoria.
- Financeiro do vendedor.
- Equipe (RBAC vendedor + convites).
- Níveis (LIT-MAX) calculados periodicamente.

## Fase 5 — Pagamentos (dev sênior + revisão de segurança)

- Gateway: Stripe / PagBank / MercadoPago / Adyen.
- Pix (BR): via gateway ou direto com PSP autorizado.
- Boleto.
- Cartão (**tokenização, nunca armazenar PAN**, PCI-DSS).
- Split entre vendedor / plataforma / afiliado.
- Wallet (`wallet_accounts` + `wallet_transactions` ledger).
- Escrow: `available`, `pending`, `held`, `frozen`.
- Taxas + Proteção LIT + LIT Points.
- Chargeback / estorno / disputa.
- Saques (`withdrawals`) com KYC obrigatório.
- Conciliação bancária.
- **Webhooks idempotentes**.

## Fase 6 — Mediação e segurança

- Chat realtime + moderação server-side (regras + LIT-MAX).
- Máquina de mediação com SLA + prazos automáticos.
- Denúncias (`reports`) com evidências assinadas.
- Upload seguro (antivírus, limites, MIME check).
- Antifraude (regras + score + revisão manual).
- Admin real com auditoria imutável.

## Fase 7 — Comunicação

- Provedor transacional (Resend / SendGrid / SES).
- Templates versionados no banco.
- Preferências por usuário e por canal.
- Alertas de segurança (novo dispositivo, alteração de senha, saque).
- Web Push + fallback e-mail.

## Fase 8 — Afiliados e growth

- Tracking com token/short-link (sem cookie de terceiros se possível).
- Atribuição last-click / multi-touch.
- Ledger de comissões.
- Campanhas + materiais versionados.
- Antifraude (self-referral, cliques falsos).
- Saque com KYC.

## Fase 9 — Produção

- Deploy frontend (Cloudflare Pages / Vercel / Netlify).
- Backend gerenciado (Supabase Cloud).
- Monitoramento (Sentry / Logtail / Better Stack).
- Logs centralizados + retenção.
- Backups automatizados + testes de restore.
- LGPD: DPO, política, direitos do titular, retenção.
- Termos e privacidade revisados por jurídico.
- Performance: caching, imagens otimizadas, CDN.
- SEO/SSR para páginas públicas.
- Analytics real com **consent banner LGPD**.

## Fases críticas (exigem dev sênior + revisão externa)

- Fase 1 (fundação, RLS).
- Fase 5 (pagamentos, escrow, PCI).
- Fase 6 (mediação, antifraude, KYC).
- Fase 9 (LGPD, jurídico, deploy).

Riscos: pular qualquer uma dessas fases sem especialista expõe a
plataforma a fraude financeira, vazamento de dados e sanções jurídicas.

## Atualização — autenticação real auditada (2026-07-17)

A fundação de autenticação NestJS/PostgreSQL/Redis para cadastro, sessão, dispositivo, senha, e-mail, telefone, 2FA, step-up e recovery codes foi auditada e documentada em `AUTHENTICATION_FINAL_AUDIT.md`. Antes de avançar para pagamentos, seller/admin, wallet ou KYC, executar CI/staging e hardening operacional de auth.
