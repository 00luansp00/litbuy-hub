# LIT Buy — Architecture

Documento vivo descrevendo a arquitetura frontend do marketplace **LIT Buy**. Leia antes de adicionar qualquer módulo novo.

## Stack

- **React 19** + **TypeScript**
- **TanStack Start / Router** (file-based routing em `src/routes/`)
- **TanStack Query** (pronto para uso via `queryClient` no contexto do router)
- **Vite 7** + **Tailwind CSS v4** (tokens em `src/styles.css`)
- **shadcn/ui** (`src/components/ui/`) + **lucide-react**
- **motion** (framer-motion) para animações discretas

## Estrutura de pastas

```
src/
├── components/
│   ├── ui/            # shadcn primitives — NÃO editar
│   ├── common/        # componentes reutilizáveis de domínio
│   ├── layout/        # Navbar, Footer, shells globais
│   ├── home/          # seções da home
│   └── auth/          # blocos de autenticação (AuthLayout, AuthCard, etc.)
├── data/              # mocks estáticos (categorias, produtos)
├── hooks/             # hooks reutilizáveis
├── lib/               # utilitários puros (format, utils, error reporting)
├── providers/         # React contexts (AuthProvider, ...)
├── routes/            # file-based routing do TanStack
├── services/          # camada assíncrona (mocks hoje, HTTP amanhã)
├── types/             # contratos TS compartilhados
├── router.tsx         # bootstrap do router
├── server.ts          # entry SSR
├── start.ts           # entry client
└── styles.css         # design system (tokens, utilities)
```

### Responsabilidades

| Pasta          | Responsabilidade                                                                 |
| -------------- | -------------------------------------------------------------------------------- |
| `components/ui`| Primitivas visuais (Button, Input, Dropdown, ...). Substituíveis apenas via shadcn. |
| `components/common` | Peças reaproveitadas em várias features: `ProductCard`, `SectionHeader`, `PlaceholderPage`, `Logo`, `CategoryCard`. |
| `components/layout` | Estruturas globais: `Navbar`, `Footer`. Consomem `useAuth()`. |
| `components/home` | Blocos exclusivos da home (`Hero`, `ProductSection`, `MarketplaceStats`, ...). |
| `components/auth` | Blocos de autenticação: `AuthLayout`, `AuthCard`, `AuthHeader`, `AuthDivider`, `PasswordInput`, `FormFooter`. |
| `data`         | Fixtures TypeScript tipadas por `src/types/`. Nunca importar de componentes de UI. |
| `providers`    | Contexts globais. Hoje: `AuthProvider` (mock em memória). |
| `services`     | Fachadas assíncronas — `productService`, `sellerService`, `reviewService`, `authMock`. Mesma assinatura que a API real terá. |
| `routes`       | Cada arquivo é uma rota. Placeholders usam `PlaceholderPage`. |

## Rotas

Rotas atuais (todas registradas em `src/routes/`):

| Path                   | Arquivo                       | Estado           |
| ---------------------- | ----------------------------- | ---------------- |
| `/`                    | `index.tsx`                   | Home completa    |
| `/login`               | `login.tsx`                   | Mock funcional   |
| `/cadastro`            | `cadastro.tsx`                | Mock funcional   |
| `/recuperar-senha`     | `recuperar-senha.tsx`         | Mock funcional   |
| `/perfil`              | `perfil.tsx`                  | Placeholder      |
| `/pedidos`             | `pedidos.tsx`                 | Placeholder      |
| `/favoritos`           | `favoritos.tsx`               | Placeholder      |
| `/carteira`            | `carteira.tsx`                | Placeholder      |
| `/mensagens`           | `mensagens.tsx`               | Placeholder      |
| `/carrinho`            | `carrinho.tsx`                | Placeholder      |
| `/checkout`            | `checkout.tsx`                | Placeholder      |
| `/vendedor`            | `vendedor.tsx`                | Reservada — futuro **painel do vendedor** |
| `/loja/$slug`          | `loja.$slug.tsx`              | Perfil público da loja |
| `/admin`               | `admin.tsx`                   | Placeholder      |
| `/categoria/$slug`     | `categoria.$slug.tsx`         | Placeholder      |
| `/produto/$id`         | `produto.$id.tsx`             | Placeholder      |

Nunca renomeie ou remova uma rota sem migração — links internos usam `<Link to="...">` tipado.

## Design System

Todos os tokens estão em `src/styles.css` via `@theme inline`. Utilitários customizados: `container-lit`, `text-gradient`, `bg-hero`, `shadow-elegant`, `shadow-card`. **Componentes NÃO devem hardcodar cor** — sempre usar tokens semânticos.

## Autenticação (mock)

- Fonte da verdade: `src/services/authMock.ts` (funções puras `login`, `logout`, `getSession`).
- Estado reativo: `src/providers/AuthProvider.tsx` expõe `useAuth() → { user, isAuthenticated, login, logout, loading }`.
- Preparado para trocar `authMock` por chamadas HTTP reais mantendo a mesma assinatura.
- `Navbar` lê `useAuth()` para alternar entre botões de entrar/cadastrar e menu do usuário.

## Como adicionar um novo módulo

1. **Types primeiro** — declare contratos em `src/types/`.
2. **Service** — crie/estenda um arquivo em `src/services/` com funções assíncronas.
3. **Componentes** — coloque blocos reutilizáveis em `components/common/`, específicos em `components/<feature>/`.
4. **Rota** — adicione um arquivo em `src/routes/` (`createFileRoute`). Se for placeholder, use `PlaceholderPage`.
5. **Provider** (se necessário) — adicione contexto em `src/providers/` e monte no `RootComponent`.
6. **Documente** — atualize este arquivo e, se aplicável, `PROJECT_RULES.md`.

## Camada de dados (atual vs futura)

- **Hoje:** toda leitura passa por `src/services/*` que consomem mocks estáticos de `src/data/`. Componentes e rotas **nunca** importam de `src/data/` diretamente — sempre via service.
- **Amanhã:** os services serão substituídos por chamadas HTTP ao Supabase (Data API / server functions), mantendo **a mesma assinatura pública**. Nenhum componente de UI precisará mudar.
- **Sem conexão real ainda:** não há Supabase configurado, nem client HTTP, nem variáveis de ambiente de backend. A ativação será feita em sprint dedicada.
- **Contrato de dados futuro:** ver `DATABASE_SCHEMA.md`, `ENTITY_RELATIONSHIP.md` e `SUPABASE_RLS_PLAN.md` na raiz do projeto. Toda nova entidade deve ser compatível com esse contrato para evitar dívida técnica.

## Convenções finais

- Nunca introduzir React Router DOM ou pastas `src/pages/`.
- Nunca editar `src/routeTree.gen.ts`.
- Sempre preferir composição a props booleanas explosivas.
- Sempre passar por `useAuth()` para qualquer decisão baseada em sessão.
- Sempre passar por `src/services/*` para leitura/escrita de dados — nunca importar mocks direto na UI.


## Ajuste arquitetural pós-Sprint 14

- **Duplo papel do usuário**: a mesma conta pode atuar como comprador e vendedor. O mock (`authMock` / `AuthUser`) expõe `hasSellerProfile`, `sellerSlug`, `sellerName` e `activeRole` (`"buyer" | "seller"`). O `AuthProvider` expõe `switchToBuyer()`, `switchToSeller()` e `toggleRole()` — tudo em memória, sem persistência, sem LocalStorage, sem cookies.
- **UserMenu adaptativo**: o menu do Navbar troca entre opções de comprador e vendedor a partir de `activeRole` e permite alternar via toast + navegação.
- **ImageUploader (`src/components/common/ImageUploader.tsx`)**: uploader premium visual/mockado — drag-and-drop, thumbnails, simulação de progresso, limite visual e estado de erro. Usa a File API apenas para previews locais (Object URLs). Não envia arquivos, não persiste nada.
- **Produtos com `stock` e `status`**: `Product.status: "active" | "paused"` e `Product.stock?: number` fazem parte do contrato. A regra de disponibilidade é centralizada em `productService.isProductAvailable()` / `getUnavailabilityReason()`. Nenhum componente deve reimplementar essa regra.
- **Carrinho e checkout**: `CartProvider.addItem` bloqueia produtos indisponíveis com toast. O checkout detecta itens que ficaram indisponíveis em memória e bloqueia a finalização mockada até que sejam removidos.

## Painel Administrativo (mock)

O Painel Administrativo em `/admin` é totalmente **visual e mockado**.

- **AdminGate** (`src/components/admin/AdminGate.tsx`): proteção visual apenas. Verifica `isAuthenticated` + `isAdmin` do `AuthProvider` (mock em memória). Não é RBAC real.
- **AdminLayout** (`src/components/admin/AdminLayout.tsx`): casca reutilizável com `AdminHeader`, `AdminSidebar` (desktop) e menu horizontal (mobile).
- **AdminHeader**: exibe título, badges "Modo demonstração" / "Mock", avatar do admin e ações mockadas (Exportar, Atualizar).
- **adminService** (`src/services/adminService.ts`): única fonte de dados para as páginas admin. Nenhuma página admin acessa mocks diretamente.
- Subrotas: `/admin`, `/admin/usuarios`, `/admin/vendedores`, `/admin/anuncios`, `/admin/pedidos`, `/admin/transacoes`, `/admin/disputas`, `/admin/denuncias`, `/admin/configuracoes`.
- Todas as ações administrativas apenas disparam `toast` — nenhuma alteração é persistida.
- O usuário mockado atual tem `isAdmin: true` apenas para demonstração do MVP.

Permissões reais (RBAC, moderação, suspensão, disputas, financeiro) exigem backend e serão implementadas em sprints futuras.

## Modelo de conta (MVP mockado)

O usuário mockado (`AuthUser` em `src/services/authMock.ts`) tem:

- `id`, `name`, `email`, `avatarUrl?`
- `activeRole: "buyer" | "seller"` — contexto visual da navegação
- `sellerSlug` / `sellerName` — loja pública demo (todo usuário tem)
- `hasSellerProfile` — legado, sempre `true`, **não** usado como gate
- `isAdmin` — `true` apenas quando o email é `admin@litbuy.com`

`AuthProvider` expõe `switchToBuyer` / `switchToSeller` / `toggleRole`
que apenas alteram `activeRole` em memória. Não há verificação de perfil,
não há persistência (`localStorage`/cookie), não há permissão real.

`AuthGate` protege rotas privadas comuns (perfil, pedidos, favoritos,
mensagens, carteira, checkout **e toda a área do vendedor**) exigindo
apenas login. `AdminGate` adicionalmente exige `isAdmin` — mas ambos
são **proteção visual**. Segurança real vai para o backend (ver
`SECURITY_NOTES.md` e `SUPABASE_RLS_PLAN.md`).

## Busca Global (Sprint 18.3)

- Rota `/buscar` recebe query string `?q=termo` (validado com zod via `validateSearch`).
- `searchService` (`src/services/searchService.ts`) centraliza toda a lógica de busca mockada: filtra por título, categoria, vendedor e descrição.
- Métodos: `searchProducts`, `getPopularSearches`, `getSearchSuggestions`, `getSearchFilters`, `getSearchStats`.
- Componentes visuais em `src/components/search/`: `SearchPageHeader`, `SearchFiltersPanel`, `SearchSortBar`, `PopularSearches`, `SearchSuggestions`.
- Reutiliza `ProductGrid`, `ProductCard`, `EmptyState`, `CategoriesGrid`, `SectionHeader`.
- Filtros e ordenação são aplicados em memória (mock). Nenhum backend/API/indexação real foi implementado.
- Produtos indisponíveis continuam bloqueados pelo `ProductCard` (regra de `getUnavailabilityReason` preservada).
- Navbar (desktop e mobile) submete via `<form>` para `/buscar?q=termo`.
- Substituição futura: `searchService` deve ser reescrito para consumir API/backend (Postgres FTS, Algolia, Meilisearch) mantendo a mesma assinatura de contrato.
- Páginas NÃO devem filtrar `@/data/*` diretamente para busca — sempre passar por `searchService`.

## Sprint 18.7 — Listing Wizard Avançado

- Rota: `/vendedor/anuncios/novo` (mantida, apenas evoluída).
- Componentes: `src/components/seller-dashboard/listing-wizard/*`
  - `DynamicItemsEditor`, `ServiceFields`, `AccountFields`, `AttributesFields`,
    `SecureVaultMock`, `PromotionCards`, `LitMaxPlanCard`,
    `AutomaticMessageField`, `NotificationsPrefs`.
- Service: `src/services/listingDraftService.ts` (mocks para modelos, tipos,
  categorias/subcategorias, atributos, planos de destaque e planos de
  vendedor + `simulateSubmitListingDraft`).
- Tipos novos em `src/types/index.ts`: `ListingModel`, `ListingProductType`,
  `ListingVariant`, `ListingDeliveryMode`, `ListingPromotionTier`,
  `SellerPlanType`, `ListingAccountInfo`, `ListingAttributeConfig`,
  `ListingAttributeValue`, `ListingNotificationPreferences`,
  `PromotionTierInfo`, `SellerPlanInfo`, `Subcategory`, `ListingDraft`.
- Decisão: manter tudo mockado; sem backend, sem persistência, sem upload real.
- Futuro: cofre de entrega automática exige backend com criptografia e
  auditoria; atributos por subcategoria devem migrar para configuração no admin.

## Sprint 18.8 — módulos adicionados

- `src/components/product/ProductVariantSelector.tsx` — seletor de variação (dynamic).
- `src/components/product/VirtualCurrencyQuoteBox.tsx` — cotação visual de moeda virtual.
- `src/components/product/AccountInfoCard.tsx` — informações declaradas de conta.
- `src/components/product/ProductDetailsSpecs.tsx` — resumo do anúncio.
- `src/components/product/ProductQuestions.tsx` — perguntas públicas.
- `src/components/cart/MiniCartModal.tsx` — confirmação pós-add ao carrinho.
- `src/services/questionService.ts` — mock de perguntas públicas (em memória).
- `src/utils/moderation.ts` — censura visual anti-poaching (mock).
- CartItem passa a suportar `selectedVariantId/Title/Price` e `virtualCurrencyUnit`;
  chave composta em `item.key`. Compatível com produtos antigos.
- Product recebe campos opcionais (listingModel, productType, variants,
  virtualCurrency, accountInfo, deliveryMode, promotionTier, sellerPlan, ...).

## Sprint 18.9 — Checkout avançado e pagamento pendente

- `src/services/paymentService.ts` — métodos, planos de proteção, saldo
  mock LIT, LIT Points, cálculo de taxas e criação de `PaymentIntent`
  in-memory. Nenhum pagamento real é gerado.
- `src/services/analyticsService.ts` — track() mockado
  (`console.debug` em dev).
- `src/components/checkout/CheckoutProtectionPlanSection.tsx`,
  `CheckoutLitPointsCard.tsx`, `PaymentMethodBlock.tsx` — blocos visuais
  específicos por método.
- `src/routes/pagamento.$id.tsx` — tela de pagamento pendente.
- `Order.litProtection` opcional para exibir badge no /pedidos/$id.
- Futura integração real: substituir `paymentService` por gateway
  (Pix/Boleto/Cartão) via server function; `analyticsService` por
  provider server-side.

## Sprint 18.10 — LIT Points, Tarifas, Prazos e Níveis de Vendedor

- Programa LIT Points é próprio da LIT Buy. Não é dinheiro, não é saldo financeiro, não pode ser sacado.
- Rotas públicas `/lit-points` e `/taxas` explicam programa, tarifas, prazos e níveis de vendedor.
- Níveis Bronze/Prata/Ouro/Diamante/Elite são visuais e mockados.
- Taxas e prazos exibidos são demonstrativos. Cálculo real, cobrança, split, escrow, saques e assinatura LIT-MAX exigem backend.
- Saldo LIT é separado de LIT Points. Saldo pendente/disponível/bloqueado é apenas visual.
- Services: `litPointsService`, `sellerLevelService`, `platformEconomicsService` — todos mockados, sem persistência.
- Integrações leves em `/carteira`, `/vendedor`, `/vendedor/financeiro`, `/loja/$slug` e `/produto/$id`.
- Footer aponta para `/lit-points` e `/taxas`.

## Sprint 18.11 — Verificação e Equipe do Vendedor
- **Services**: `src/services/verificationService.ts`, `src/services/sellerTeamService.ts`.
- **Rotas**: `/perfil/verificacao`, `/vendedor/equipe` (usam `AuthGate` e os layouts existentes).
- **Componentes de verificação**: `src/components/verification/` — `VerificationStatusCard`, `VerificationSteps`, `VerificationBasicStep`, `VerificationSmsStep`, `VerificationDocumentStep`, `VerificationSelfieStep`, `VerificationReviewStep`, `VerificationTimeline`, `VerificationSecurityNotice`, `SellerVerificationBadge`.
- **Componentes de equipe**: `src/components/seller-dashboard/team/` — `SellerTeamOverview`, `SellerTeamMembersList`, `SellerTeamMemberCard`, `SellerTeamInviteDialog`, `SellerTeamRolesCards`, `SellerTeamPermissionsMatrix`, `SellerTeamActivity`, `SellerTeamSecurityNotice`.
- **Integrações leves**: sidebar do usuário e do vendedor ganham entradas Verificação/Equipe; `/perfil` e `/vendedor` mostram `VerificationStatusCard`; wizard mostra aviso não bloqueante.
- **Futuro (backend)**: substituir `verificationService` por integração com fornecedor de KYC e substituir `sellerTeamService` por RBAC real com convites por e-mail e audit log.

## Sprint 18.12 — Admin Avançado
- **Service**: `src/services/adminAdvancedService.ts` (catálogo, permissões, KYC, financeiro, planos, flags, conteúdo, relatórios, auditoria).
- **Rotas novas**: `/admin/catalogo`, `/admin/permissoes`, `/admin/verificacoes`, `/admin/financeiro`, `/admin/conteudo`, `/admin/relatorios`, `/admin/auditoria`.
- **Sidebar**: `AdminSidebar` agora agrupado em Operação / Pessoas / Plataforma.
- **Dashboard**: `/admin` ganha bloco de Ações Rápidas com deep-links para as novas áreas.
- **Configurações**: aba de Feature Flags integrada ao `/admin/configuracoes`.
- **Futuro (backend)**: substituir mocks por serviços de config, RBAC, CMS, gateway, motor de reputação, KYC provider e audit log imutável.

## Sprint 18.13 — Detalhe da Venda, Chat do Pedido, Entrega e Mediação (mock)

- Pagamento aprovado (mock) formaliza a criação de uma conversa vinculada ao pedido (`order_related`), acessível em `/pedidos/$id` e em `/mensagens/$id`.
- Chat do pedido é o canal oficial para entrega, suporte e mediação. Conversa fora da plataforma reduz proteção futura.
- Entrega manual e entrega automática são exibidas de forma **visual/mockada** (nunca revelam dados reais). Cofre e criptografia reais exigem backend.
- Central de Mediação (mock) cobre motivos, provas, réplica do vendedor, timeline e trechos do chat como evidência.
- Rota `/vendedor/vendas/$id` mostra a visão do vendedor: comprador, produto, pagamento, entrega, chat, financeiro, timeline e mediação.
- Services: `sellerSaleService`, extensões em `orderService` e `messageService`; nenhum dado é persistido.
- Confirmação de recebimento, liberação de saldo, uploads reais e decisões de mediação **só podem ocorrer no backend real**.

## Sprint 18.14 — Central de Notificações (mock)

- Central visual/mockada: `notificationService` + `NotificationProvider` (`useNotifications`).
- Sino na Navbar (`NotificationBell`): dropdown no desktop, navegação para `/notificacoes` no mobile.
- Rota nova: `/notificacoes` com filtros, contagem de não lidas, marcar como lida / marcar todas / arquivar (tudo em memória).
- Notificações são geradas por papel — comprador, vendedor, admin — e cobrem pedido, pagamento, entrega, chat, mediação, vendas, KYC, denúncias, financeiro e admin.
- Notificações apontam para rotas reais quando existem (`/pedidos/$id`, `/vendedor/vendas/$id`, `/mensagens/$id`, `/admin/*`, `/lit-points`, etc.).
- **Nada é persistido**: sem LocalStorage, sem Cookies, sem backend. Push, e-mail, SMS, WebSocket e Service Worker **não** são implementados — exigem backend real, opt-in do usuário e infra de mensageria.
- Dados sensíveis nunca devem aparecer em notificações — títulos e descrições são genéricos e mascarados.

## Sprint 18.15 — Denúncias / Reports

- `src/services/reportService.ts`: mock service com motivos por tipo de alvo, severidade, guidelines, `simulateSubmitReport`, `getReportsForAdmin`, `getUserReports`, `getReportById`.
- `src/components/report/ReportDialog.tsx`, `ReportButton.tsx`, `ReportSeverityBadge.tsx`, `ReportStatusBadge.tsx`, `ReportSecurityNotice.tsx`.
- Integrações: `produto.$id`, `loja.$slug`, `mensagens.$id`, `OrderChatCard`, `OrderActionsCard` (`/pedidos/$id`), `SellerSaleDetailView` (`/vendedor/vendas/$id`).
- Admin `/admin/denuncias` consome `reportService.getReportsForAdmin()` e mostra drawer de detalhe com contexto, evidências, notas internas e ações mockadas.
- Tipos centralizados: `Report`, `ReportTargetType`, `ReportReason`, `ReportPayload`, `ReportStatus`, `ReportSeverity`, `ReportEvidence`, `ReportContext`, `ReportSource`, `ReportResolution` em `src/types/index.ts`.
- Futuro: substituir mocks por backend/moderação/audit log; evidências em storage seguro; ações admin protegidas por RBAC.

## Sprint 18.16 — Afiliados
- Rota: `/afiliados` (AuthGate).
- Service: `src/services/affiliateService.ts` (mock).
- Componentes em `src/components/affiliate/` — Hero, Status, Link, Stats, Conversions, Commission, Campaigns, Materials, Rules, Faq, SecurityNotice, PayoutPreview, ProfileCard.
- Integrações leves em `/perfil`, `/carteira`, `/vendedor`, `/admin/relatorios`.
- Notificações de afiliados: tipo `affiliate` no `notificationService` (mock).
- Futuro: backend de tracking/atribuição, antifraude, financeiro e admin de afiliados.

## Sprint 18.17 — Camada Institucional

- `src/services/infoService.ts` centraliza FAQs, categorias de ajuda, passos, regras, itens proibidos, política de reembolso, termos, privacidade e canais de contato.
- `src/components/info/InfoPageLayout.tsx` reúne os primitivos reutilizáveis das páginas institucionais.
- Rotas: `/ajuda`, `/como-comprar`, `/como-vender`, `/seguranca`, `/regras-da-plataforma`, `/itens-proibidos`, `/politica-de-reembolso`, `/termos`, `/privacidade`, `/contato`.
- Em produção, o conteúdo institucional poderá migrar para um CMS ou área do admin. Hoje é todo mockado.
- SEO básico está limitado ao `head()` por rota (título, descrição, og:*). SSR/SEO avançado será tratado em sprint dedicada (18.18).

## Sprint 18.18 — Chat Oficial do Pedido + Mediação Guiada
- `OrderChatCard` evoluído: cabeçalho "Chat oficial do pedido", banner de manual de instruções (link para `/regras-da-plataforma` e `/seguranca`), banner de prazo de mediação (`OrderChatMediationBanner`), botão fixo "Reportar problema", divisores de data (Hoje/Ontem), botão "Última mensagem", mensagens automáticas do sistema derivadas por `orderSupportService.getOrderSystemMessages`, mensagem automática do vendedor (LIT-MAX) com sanitização anti-poaching.
- `OrderProblemDialog` reescrito como fluxo guiado em 3 passos: motivo → descrição (mínimo 10 caracteres, contador visual) → evidências opcionais (mock). Mostra prazo da categoria e aviso de saldo retido. Motivos "contato externo" e "comprador suspeito" sugerem denúncia paralela.
- `orderSupportService` centraliza `getMediationDeadline`, `getSupportWindow` (aceita pedido ou venda), `getOrderSystemMessages` e a lista `MEDIATION_REASONS`. Nenhum backend — todos os prazos são derivados de `createdAt`, `deliveryMode` e `protectionLitActive`.
- Visão do vendedor (`SellerSaleDetailView`) reaproveita `OrderChatMediationBanner` e `OrderProblemDialog` com `perspective="seller"`.
- `/mensagens/$id`: quando `conversation.type === "order_related"`, exibe chip "Pedido vinculado", prazo de mediação, botão "Ver pedido" e botão "Reportar problema" (abre `OrderProblemDialog`).
- Financeiro da venda mostra "Saldo bloqueado em mediação" quando `financial.blockedInDispute > 0`. Retenção real depende de backend financeiro.

## Sprint 18.19 — Camada visual de e-mails transacionais

- `src/services/transactionalEmailService.ts` — service 100% mockado com
  eventos transacionais, templates, preferências de comunicação, histórico
  visual e simulação de envio/reenvio.
- Rotas visuais:
  - `/verificar-email` — pós-cadastro / confirmação de e-mail.
  - `/redefinir-senha` — formulário mockado de nova senha.
  - `/verificacao-login` — novo dispositivo com código mock.
  - `/perfil/preferencias` — preferências por canal e histórico.
- `src/components/email/*` — cards e painéis reutilizáveis (verificação,
  preferências, histórico, preview de template, panel de login novo, etc.).
- Integrações leves:
  - `/perfil` linka para `/perfil/preferencias`.
  - `AccountSidebar` inclui "Preferências".
  - `/admin/conteudo` ganhou seção "Templates de e-mail transacional".
- Integração futura: Supabase Auth para verificação/reset de senha, e um
  provedor (Resend/SendGrid/SES) para envio real dos templates, protegidos
  por tokens, políticas RLS e assinatura de webhooks.
