# BACKEND_ROADMAP.md — LIT Buy

Roadmap recomendado para transformar o MVP visual em produto real, considerando a arquitetura real atual.

## Stack atual autoritativa

- Frontend React + TypeScript + Vite.
- Backend NestJS.
- PostgreSQL + Prisma.
- Redis.
- API REST `/api/v1`.
- Arquitetura modular monolith.
- Storage S3-compatible futuro conforme domínio.
- Sem dependência obrigatória de Supabase.

A fundação real de autenticação já existe em NestJS/PostgreSQL/Redis e está documentada em `AUTHENTICATION_FINAL_AUDIT.md`; não tratar escolha de backend ou implementação de auth terceirizada como trabalho futuro de autenticação.

## Fase 1 — Fundação técnica remanescente (dev experiente obrigatório)

- Completar RBAC/autorização server-side para marketplace, vendedor e admin.
- Definir políticas server-side equivalentes a RLS/checks por domínio sensível.
- Consolidar logs de auditoria append-only para eventos financeiros, seller/admin e moderação.
- Definir storage S3-compatible para produtos, KYC, evidências e cofre conforme cada domínio entrar no escopo.
- Consolidar variáveis de ambiente e secrets por ambiente.

## Plano histórico descontinuado / não autoritativo

As versões iniciais deste roadmap assumiam Supabase, auth gerenciada e funções de borda. Esse plano é histórico e não é autoritativo para a arquitetura atual, que usa backend NestJS, PostgreSQL/Prisma, Redis e API REST `/api/v1`.

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
- Backend gerenciado para a API NestJS atual (provedor a definir sem dependência obrigatória de Supabase).
- Monitoramento (Sentry / Logtail / Better Stack).
- Logs centralizados + retenção.
- Backups automatizados + testes de restore.
- LGPD: DPO, política, direitos do titular, retenção.
- Termos e privacidade revisados por jurídico.
- Performance: caching, imagens otimizadas, CDN.
- SEO/SSR para páginas públicas.
- Analytics real com **consent banner LGPD**.

## Fases críticas (exigem dev sênior + revisão externa)

- Fundação de autorização/RBAC, auditoria e políticas server-side para domínios de marketplace.
- Fase 5 (pagamentos, escrow, PCI).
- Fase 6 (mediação, antifraude, KYC).
- Fase 9 (LGPD, jurídico, deploy).

Riscos: pular qualquer uma dessas fases sem especialista expõe a
plataforma a fraude financeira, vazamento de dados e sanções jurídicas.

## Atualização — autenticação real auditada (2026-07-17)

A fundação de autenticação NestJS/PostgreSQL/Redis para cadastro, sessão, dispositivo, senha, e-mail, telefone, 2FA, step-up e recovery codes foi auditada e documentada em `AUTHENTICATION_FINAL_AUDIT.md`. Antes de avançar para pagamentos, seller/admin, wallet ou KYC, executar staging, homologação e hardening operacional de auth.

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

## Product materialization foundation (2026-07-19)

- `ListingDraft` aprovado passa a gerar exatamente um `Product` interno `UNPUBLISHED`, transacional e idempotente.
- Publicação pública, imagens, compra, pedido, pagamento e estoque reservado continuam em etapas futuras.
