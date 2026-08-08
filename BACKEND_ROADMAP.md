# BACKEND_ROADMAP.md — LIT Buy

> **PR #48:** vendas com pedido `ACTIVE`, pagamento `PAID` e snapshot financeiro imutável agora são reconhecidas no ledger interno via `SALE_RECOGNIZED`: debitam `PROVIDER_CLEARING` e creditam `SELLER_PENDING`/`PLATFORM_COMMISSION`. O seller permanece pendente; sem settlement, hold, saque, PSP, fulfillment, refund ou chargeback.

> **Seller hold foundation:** pedidos concluídos e confirmados movem proceeds do snapshot de `SELLER_PENDING` para `SELLER_HELD`, com hold de proteção sem prazo. `AVAILABLE`, settlement, saque e PSP permanecem fora do escopo.

> **Contrato comercial vigente:** `COMMERCE_ARCHITECTURE.md` é a fonte autoritativa. O conteúdo comercial histórico abaixo é preliminar ou substituído quando divergir; pagamentos e ledger não estão implementados, e nenhum gateway foi escolhido.

> Concluída a fundação isolada de dados locais determinísticos para PostgreSQL e MinIO; ela não adiciona endpoints nem altera lifecycle.

> A fundação de leitura pública da PR #29 já foi adotada por Home, categoria e detalhe; busca, loja, comércio e reserva de estoque permanecem marcos futuros. Consulte `PUBLIC_CATALOG_READ_FOUNDATION.md`.

> Estado atual: Home, categoria e detalhe já consomem o catálogo público real. Busca, loja e comércio permanecem pendentes.

Roadmap recomendado para transformar o MVP visual em produto real, considerando a arquitetura real atual.

## Stack atual autoritativa

- Frontend React + TypeScript + Vite.
- Backend NestJS.
- PostgreSQL + Prisma.
- Redis.
- API REST `/api/v1`.
- Arquitetura modular monolith.
- MinIO/S3 compatível privado já atende imagens de produto na fundação local; KYC, disputas, evidências e outros domínios exigem planejamento de storage próprio.
- Sem dependência obrigatória de Supabase.

A fundação real de autenticação já existe em NestJS/PostgreSQL/Redis e está documentada em `AUTHENTICATION_FINAL_AUDIT.md`; não tratar escolha de backend ou implementação de auth terceirizada como trabalho futuro de autenticação.

## Fase 1 — Fundação técnica remanescente (dev experiente obrigatório)

- Completar RBAC/autorização server-side para marketplace, vendedor e admin.
- Definir políticas server-side equivalentes a RLS/checks por domínio sensível.
- Consolidar logs de auditoria append-only para eventos financeiros, seller/admin e moderação.
- Manter o storage privado de produtos e planejar separadamente storage para KYC, evidências, disputas e cofre quando cada domínio entrar no escopo.
- Consolidar variáveis de ambiente e secrets por ambiente.

## Plano histórico descontinuado / não autoritativo

As versões iniciais deste roadmap assumiam Supabase, auth gerenciada e funções de borda. Esse plano é histórico e não é autoritativo para a arquitetura atual, que usa backend NestJS, PostgreSQL/Prisma, Redis e API REST `/api/v1`.

## Estado da fase de catálogo

- **Concluído:** lifecycle persistente, leitura pública, Home, categoria, detalhe e imagens privadas assinadas no rehearsal local.
- **Parcialmente concluído:** a adoção frontend real ainda coexiste com superfícies legadas demonstrativas.
- **Pendente:** busca, loja pública, comércio e storage de domínios alheios a produto.

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

# Product images (implemented foundation)

S3-compatible direct upload, server-side confirmation, internal seller management, and read-only admin inspection are real. Publication/CDN/transformation remain future work; see `PRODUCT_IMAGE_STORAGE_FOUNDATION.md`.

## Product lifecycle foundation (2026-07-28, PR #28)

O estado `ACTIVE` de produto agora é persistente e controlado pelo vendedor proprietário via backend, com elegibilidade transacional, versão otimista, advisory lock, idempotência e auditoria. Isso **não** conecta catálogo público nem torna qualquer produto comprável. Estoque/reserva, checkout, pagamentos e mutações administrativas de lifecycle continuam pendentes. O contrato autoritativo está em `PRODUCT_LIFECYCLE_FOUNDATION.md`.

## Catálogo público por categoria

A rota `/categoria/$slug` usa produtos e subcategorias públicos reais, com filtros suportados e paginação sem total. O detalhe público está conectado pelo slug; comércio continua desconectado. Consulte `CATEGORY_PUBLIC_CATALOG_INTEGRATION.md`.

## Detalhe público do produto (PR #33)

A rota legada `/produto/$id` interpreta `$id` como slug e lê somente `GET /api/v1/catalog/products/:slug`, com parser defensivo, galeria assinada, variantes/serviços reais e estados seguros. Apenas cards do catálogo público navegam para ela; superfícies legadas continuam demonstrativas e sem link automático. Compra, carrinho, checkout, loja, avaliações, perguntas e relacionados não estão conectados. Consulte `PRODUCT_DETAIL_PUBLIC_CATALOG_INTEGRATION.md`.

## Commerce increment PR #36

Persistent buyer carts are implemented as an isolated `CartsModule`, including Prisma constraints, authenticated owner authorization, CSRF, optimistic concurrency, advisory locks, safe audit events, and catalog reconciliation. Checkout/order/payment remain roadmap work; PR #37 must build on this boundary rather than treating cart previews as historical snapshots.

## PR #37 — checkout and order core

The backend now contains the server-side checkout and persistent pending-order foundation described in `ORDER_CHECKOUT_FOUNDATION.md`. It uses cart preview fingerprints, immutable snapshots, BIGINT minor units, transactional inventory reservations, idempotency, order events/outbox, buyer-only reads, pre-payment cancellation, and controlled expiration. This does **not** implement payments, a gateway, a financial ledger, webhooks, fulfillment, or a connected frontend. PR #38 remains responsible for real frontend order reading after CI validates this foundation.

## PR #39 financial foundation (ready for review; not merged)

The provider-neutral financial/ledger and versioned policy foundation is specified in [FINANCIAL_DOMAIN_FOUNDATION.md](./FINANCIAL_DOMAIN_FOUNDATION.md), [PAYMENT_PROVIDER_STRATEGY.md](./PAYMENT_PROVIDER_STRATEGY.md), [FINANCIAL_FEE_POLICY.md](./FINANCIAL_FEE_POLICY.md), and [WITHDRAWAL_POLICY.md](./WITHDRAWAL_POLICY.md). It introduces persistence and internal services only: no public endpoint, frontend flow, PSP adapter, real payment, or checkout/order behavior change. Existing displayed economics remain mocks. The next increment is sandbox integration only after written commercial approval of a selected provider.

## Fulfillment foundation (PR #49)

The authoritative post-payment fulfillment lifecycle is implemented in `OrderFulfillmentService` and specified in `ORDER_FULFILLMENT_FOUNDATION.md`. Delivery requires hashed evidence, buyer confirmation is explicit, disputes fail closed, and completion requires the valid PR #48 `SALE_RECOGNIZED` transaction. This phase does not transport secrets, auto-confirm, simulate automatic delivery, or release seller funds; proceeds remain `SELLER_PENDING` for the next financial-release phase.
