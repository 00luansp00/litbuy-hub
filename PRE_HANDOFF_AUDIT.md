# PRE_HANDOFF_AUDIT.md — LIT Buy (Sprint 18.21)

Documento de referência para o Sprint 19 — Handoff Técnico Final.

## Resumo do estado atual

- Aplicação **100% frontend/mock** em TanStack Start (React 19 + Vite 7).
- Nenhum backend, banco de dados, API, Supabase, autenticação real,
  pagamento real, e-mail real ou upload real.
- Sem persistência: não usa LocalStorage nem Cookies para dados de app
  (auth demo vive apenas em memória via `AuthProvider`).
- Typecheck limpo (`bunx tsgo --noEmit`).

## Áreas concluídas (visual / mock)

| Área | Sprint principal | Status |
| --- | --- | --- |
| Home / catálogo / busca | 18.1–18.5 | ✅ |
| Produto / variação / moeda virtual | 18.6–18.8 | ✅ |
| Carrinho / Checkout / Pagamento | 18.9–18.11 | ✅ |
| Pedidos / Chat / Mediação | 18.12, 18.18 | ✅ |
| Vendedor / Vendas / Financeiro / Equipe | 18.12, 18.13 | ✅ |
| Admin painel + avançado | 18.13 | ✅ |
| Wizard de anúncio (normal/dinâmico/serviço) | 18.7, 18.13 | ✅ |
| KYC / Verificação | 18.13 | ✅ |
| Notificações + central | 18.14 | ✅ |
| Denúncias / Report | 18.15 | ✅ |
| Afiliados | 18.16 | ✅ |
| Páginas públicas (Ajuda/Termos/Privacidade/etc.) | 18.17 | ✅ |
| Chat oficial + mediação guiada | 18.18 | ✅ |
| E-mails transacionais visuais + preferências | 18.19 | ✅ |
| SEO helper, ErrorBoundary, OfflineNotice, RetryState, 404 | 18.20 | ✅ |
| QA final + handoff prep | 18.21 | ✅ |

## Rotas principais (auditadas)

**Públicas**: `/`, `/buscar`, `/login`, `/cadastro`, `/recuperar-senha`,
`/redefinir-senha`, `/verificar-email`, `/verificacao-login`,
`/categoria/$slug`, `/produto/$id`, `/loja/$slug`, `/lit-points`,
`/taxas`, `/afiliados`, `/ajuda`, `/como-comprar`, `/como-vender`,
`/seguranca`, `/regras-da-plataforma`, `/itens-proibidos`,
`/politica-de-reembolso`, `/termos`, `/privacidade`, `/contato`.

**Usuário**: `/perfil`, `/perfil/verificacao`, `/perfil/preferencias`,
`/pedidos`, `/pedidos/$id`, `/favoritos`, `/mensagens`, `/mensagens/$id`,
`/carteira`, `/carrinho`, `/checkout`, `/pagamento/$id`, `/notificacoes`.

**Vendedor**: `/vendedor`, `/vendedor/anuncios`, `/vendedor/anuncios/novo`,
`/vendedor/vendas`, `/vendedor/vendas/$id`, `/vendedor/financeiro`,
`/vendedor/avaliacoes`, `/vendedor/equipe`.

**Admin**: `/admin`, `/admin/usuarios`, `/admin/vendedores`,
`/admin/anuncios`, `/admin/pedidos`, `/admin/transacoes`,
`/admin/disputas`, `/admin/denuncias`, `/admin/configuracoes`,
`/admin/catalogo`, `/admin/permissoes`, `/admin/verificacoes`,
`/admin/financeiro`, `/admin/conteudo`, `/admin/relatorios`,
`/admin/auditoria`.

> **Nota**: `/admin/denuncias` é a rota oficial. Nenhum link interno
> aponta para `/admin/reclamacoes`.

## Services principais (mockados)

`productService`, `categoryService`/`categories`, `sellerService`,
`cartService`, `checkoutService`, `paymentService`, `orderService`,
`orderSupportService`, `messageService`, `sellerSaleService`,
`sellerDashboardService`, `notificationService`, `reportService`,
`affiliateService`, `transactionalEmailService`, `infoService`,
`adminService`, `adminAdvancedService`, `verificationService`,
`sellerTeamService`, `litPointsService`, `platformEconomicsService`,
`sellerLevelService`, `analyticsService`, `authMock`,
`listingDraftService`, `questionService`, `reviewService`,
`searchService`.

Todos retornam dados estáticos, `[]` seguro ou `null` tratado. Nenhum
faz IO real.

## Estados de erro

- `ErrorBoundary` global (root).
- `OfflineNotice` global (SSR-safe: só monta pós-hidratação).
- `RetryState` reutilizável.
- `NotFoundComponent` amigável em `__root.tsx`.
- `EmptyState` disponível em `common/`.

## Correções feitas nesta sprint (18.21)

- Corrigido hydration-mismatch do `OfflineNotice` (leitura de
  `navigator.onLine` movida para `useEffect`, componente só monta
  após hidratação).
- Confirmado que não há referência para `/admin/reclamacoes` no código.
- Confirmado que não existe import inválido `lucide-react/dynamic`.

## Riscos / pendências conhecidas

- **SEO**: SPA client-side. Crawlers e previews sociais podem não ler
  meta tags sem SSR/SSG. Recomendado migrar rotas públicas para
  SSR/prerender no Sprint 19+.
- **Auth**: `AuthProvider` é demo; qualquer e-mail loga; admin é
  simulado por `admin@litbuy.com`. Precisa Supabase Auth real + RLS.
- **Pagamento**: `paymentService` gera IDs falsos. Integração real
  (Pix/cartão/boleto) exigirá gateway (Stripe/PagBank/MercadoPago).
- **Escrow / Wallet**: saldos, retenções, LIT Points e saques são
  visuais. Exigem backend financeiro sério + KYC real + PCI se cartão.
- **KYC**: sem OCR, sem liveness, sem provedor. Trocar por Idwall,
  Unico, Jumio ou equivalente.
- **Uploads**: nenhum arquivo é enviado. Precisa storage (S3/Supabase
  Storage) com antivírus e limites.
- **Chat/Mediação**: mensagens vivem em memória. Precisa Realtime +
  moderação server-side + trilha de auditoria.
- **Notificações**: sem push, sem WebSocket, sem e-mail. Precisa
  provedor transacional (Resend/SendGrid/SES) e Web Push.
- **Analytics**: `analyticsService` apenas `console.debug`. Integração
  real exigirá consentimento LGPD + provedor (GA4/PostHog/Plausible).
- **Denúncias / disputas**: fluxos visuais; sem workflow de moderação
  real, sem SLA, sem trilha imutável.
- **Afiliados**: sem tracking, sem cookie, sem cálculo real de comissão.
- **Admin**: `AdminGate` é apenas visual — RLS/permissões precisam ser
  reais no backend.

## O que exigirá desenvolvedor (Sprint 19+)

1. Escolher stack de backend (Supabase é o assumido em docs).
2. Modelar banco conforme `DATABASE_SCHEMA.md` +
   `ENTITY_RELATIONSHIP.md` + `SUPABASE_RLS_PLAN.md`.
3. Implementar autenticação real + verificação de e-mail + 2FA.
4. Implementar RLS granular (usuário/vendedor/admin + roles).
5. Integrar gateway de pagamento e escrow.
6. Integrar KYC.
7. Integrar Storage seguro para uploads (produtos, evidências, KYC).
8. Integrar provedor de e-mail transacional.
9. Realtime (chat, notificações, status de pedido).
10. Server-side analytics + consent banner LGPD.
11. Avaliar SSR/SSG para rotas públicas.
12. Auditoria WCAG completa.
13. Testes automatizados (unit, integration, e2e).

## O que exigirá backend

Autenticação, autorização (RLS/roles), persistência, pagamento, escrow,
wallet real, saques, KYC, storage, e-mail, push, realtime, moderação
automatizada, cron jobs (expiração de mediação/pagamento), webhooks,
integrações fiscais/NF-e, relatórios reais, auditoria/logs imutáveis.

## Documentação relacionada

- `ARCHITECTURE.md`
- `PROJECT_RULES.md`
- `MVP_STATUS.md`
- `ROUTE_AUDIT.md`
- `QA_CHECKLIST.md`
- `EDGE_CASES.md`
- `ANALYTICS_EVENTS.md`
- `SECURITY_NOTES.md`
- `DATABASE_SCHEMA.md`
- `ENTITY_RELATIONSHIP.md`
- `SUPABASE_RLS_PLAN.md`
- `ORDER_LIFECYCLE.md`
- `DISPUTE_FLOW.md`
- `MESSAGING_RULES.md`
- `WALLET_AND_ESCROW_RULES.md`
- `DIGITAL_DELIVERY_FLOW.md`
- `LISTING_STATUS_RULES.md`
- `MARKETPLACE_RULES.md`
- `REVIEW_RULES.md`

## Confirmações finais

- ✅ Typecheck limpo.
- ✅ Nenhum backend, API, Supabase, tracking, cookie ou LocalStorage.
- ✅ Nenhum dado real coletado. Avisos de demonstração presentes em
  áreas sensíveis (KYC, pagamento, saque, contato, evidências).
- ✅ ErrorBoundary global + OfflineNotice + RetryState + 404 amigável.
- ✅ `/admin/denuncias` é a rota oficial (sem `/admin/reclamacoes`).
- ✅ Pronto para o Sprint 19 — Handoff Técnico Final.
