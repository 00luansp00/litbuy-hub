# MVP_STATUS.md — LIT Buy

Snapshot do estado atual do MVP visual da LIT Buy. Este documento é
destinado ao próximo desenvolvedor / time técnico que vai migrar o
projeto para GitHub/Cursor e ligar as integrações reais.

**Regra geral do MVP atual:** o projeto é um front-end completo,
totalmente mockado, sem backend, sem persistência, sem autenticação real
e sem pagamentos reais. Toda a lógica de negócio vive em `src/services/`
e consome dados fictícios de `src/data/`.

---

## 1. O que já está pronto (visualmente)

### Público
- Home (`/`) — hero, categorias, seções de produtos, benefícios, newsletter.
- Categoria (`/categoria/$slug`) — grid com filtros/sort.
- Produto (`/produto/$id`) — galeria, descrição, avaliações, card de compra, produtos relacionados.
- Loja pública do vendedor (`/loja/$slug`) — hero, badges, sobre, produtos, avaliações, contato.
- Carrinho (`/carrinho`) — itens, cupom mockado, resumo, segurança.
- Checkout (`/checkout`) — steps, revisão, métodos de pagamento (mock), sucesso.

### Autenticação (mockada)
- `/login`, `/cadastro`, `/recuperar-senha` — apenas visuais.
- `AuthProvider` mantém usuário em memória com papel ativo (comprador/vendedor) e `isAdmin`.
- `AuthGate` protege visualmente rotas privadas.

### Área do usuário (comprador)
- `/perfil`, `/pedidos`, `/favoritos`, `/mensagens`, `/carteira`.
- Layout com `AccountHeader` + `AccountSidebar` reutilizáveis.

### Área do vendedor
- `/vendedor` (dashboard), `/vendedor/anuncios`, `/vendedor/anuncios/novo` (wizard),
  `/vendedor/vendas`, `/vendedor/financeiro`, `/vendedor/avaliacoes`.
- `SellerDashboardLayout` + sidebar + header reutilizáveis.
- `ImageUploader` apenas visual (File API + preview + progresso simulado).

### Admin
- `/admin` + subrotas: usuários, vendedores, anúncios, pedidos, transações,
  disputas, denúncias, configurações.
- Protegido por `AdminGate` (proteção **apenas visual**).
- Todas as ações administrativas exibem toast mockado.

### Arquitetura
- TanStack Start + file-based routing.
- Services intermediando páginas e mocks (`src/services/*`).
- Tipos centralizados em `src/types/index.ts`.
- Providers globais em `src/providers/` (`AuthProvider`, `CartProvider`).
- Design system com tokens semânticos em `src/styles.css`.

---

## 2. O que está mockado (precisa virar real depois)

| Área              | Estado atual                                     | Precisa de |
|-------------------|--------------------------------------------------|------------|
| Autenticação      | `authMock.ts` in-memory                          | Supabase Auth (email/senha, Google, Apple) |
| Sessão            | Não persiste; some no F5                         | Supabase session + middleware SSR |
| Roles / admin     | Flag `isAdmin` no user mock                      | Tabela `user_roles` + `has_role()` + RLS |
| Produtos          | `src/data/products.ts`                           | Tabela `products` + Data API |
| Vendedores        | `src/data/sellers.ts`                            | Tabela `sellers` |
| Categorias        | `src/data/categories.ts`                         | Tabela `categories` |
| Reviews           | `reviewService` mock                             | Tabela `reviews` |
| Carrinho          | `CartProvider` em memória (sem localStorage)     | Persistir server-side por usuário |
| Cupom             | Regra fictícia em `cartService`                  | Tabela `coupons` + validação backend |
| Checkout / pedido | `checkoutService.createOrder` gera id fake       | Integração com gateway + tabela `orders` |
| Pagamento         | Seleção visual apenas                            | Stripe/Paddle (edge function) |
| Carteira          | Saldo mockado                                    | Ledger real com movimentações |
| Upload de imagem  | `ImageUploader` só usa File API                  | Supabase Storage |
| Publicar anúncio  | Wizard visual sem persistência                   | INSERT em `products` + storage |
| Mensagens         | Conversas fixas em mock                          | Tabela `messages` + realtime |
| Favoritos         | Estático (não persiste)                          | Tabela `favorites` |
| Pedidos           | Lista fixa                                       | Tabela `orders` filtrada por `user_id` |
| Admin actions     | Só toast                                         | Server functions com `requireSupabaseAuth` + `has_role('admin')` |
| Disputas          | Estado visual                                    | Tabela `disputes` + workflow |
| Denúncias         | Estado visual                                    | Tabela `reports` |
| SEO leaf `og:image` | Placeholders                                   | Imagens hero reais |

---

## 3. O que ainda falta (fora do escopo mockado)

- Persistência real (nada usa `localStorage` ou cookies por design).
- Backend / API / server functions com Lovable Cloud.
- Schema Postgres + migrations + RLS + GRANTs.
- Webhooks de pagamento em `src/routes/api/public/*`.
- Emails transacionais (confirmação, recuperação, notificações).
- Realtime (mensagens, notificações do vendedor).
- Busca (a busca da navbar é apenas visual).
- i18n (todo o texto está em pt-BR hardcoded).
- Testes automatizados (nenhum teste unit/e2e no repo).
- Observabilidade / logs de produção.
- CI/CD e proteção de branches (a ser configurado no GitHub).

---

## 4. Partes que exigem atenção profissional

Estas áreas foram construídas apenas visualmente e **precisam ser
reimplementadas com cuidado** antes de qualquer produção:

1. **Autenticação e sessão** — nada em `authMock.ts` deve sobreviver ao
   `git switch` para o backend real. Migrar para Supabase Auth e
   substituir `AuthProvider` mantendo a mesma API pública (`user`,
   `activeRole`, `switchToBuyer`, `switchToSeller`, `isAdmin`, `logout`).
2. **RBAC do admin** — `AdminGate` é UI. A proteção real precisa vir de
   `has_role(auth.uid(), 'admin')` em RLS e em toda server function
   admin.
3. **Pagamentos e financeiro** — nunca reutilizar o fluxo de checkout
   mockado para cobrar de verdade. Reescrever com o provider escolhido
   (Stripe / Paddle) e um webhook verificado.
4. **Publicação de anúncios e upload** — o wizard atual não valida
   nada. Precisa de validação Zod server-side, Supabase Storage,
   moderação e políticas RLS por `seller_id`.
5. **Disputas / denúncias / moderação** — fluxos sensíveis; hoje só
   exibem toast.
6. **Carteira** — qualquer manipulação de saldo precisa ser server-side,
   idempotente e auditável.

---

## 5. Convenções que devem ser preservadas

- **File-based routing** com pontos: `vendedor.anuncios.novo.tsx`.
  Rotas pai com filhos precisam de `<Outlet />` (ver `ROUTE_AUDIT.md`).
- **Services intermedeiam** páginas e dados — páginas nunca importam
  de `src/data/` diretamente.
- **Tokens semânticos** para cor/gradiente/sombra em `src/styles.css`.
  Não usar `text-white`, `bg-black`, `bg-[#...]` em componentes.
- **Toast (sonner)** para toda ação mockada, nunca botão mudo.
- **AuthGate / AdminGate** só protegem visualmente — proteção real vai
  para middleware/RLS.
- **Sem `localStorage` / sem cookies** enquanto o MVP for mockado.

---

## 6. Recomendação para GitHub / Cursor / desenvolvedor

1. Fazer o push inicial preservando a estrutura atual.
2. Habilitar Lovable Cloud e criar as migrations (products, sellers,
   categories, reviews, orders, order_items, favorites, messages,
   coupons, user_roles, disputes, reports) com GRANTs + RLS.
3. Substituir cada `*Service` mockado por consultas reais, mantendo a
   assinatura pública para não quebrar as páginas.
4. Migrar `AuthProvider` para Supabase Auth e criar
   `attachSupabaseAuth` no `src/start.ts`.
5. Trocar `AdminGate` para checar `has_role` server-side além do
   visual.
6. Integrar gateway de pagamento e webhook em `/api/public/*`.
7. Ligar Supabase Storage no `ImageUploader` e no wizard de anúncio.
8. Adicionar testes e CI.
9. Remover `src/data/*` e `src/services/authMock.ts` no final.

Documentos de apoio: `ARCHITECTURE.md`, `PROJECT_RULES.md`,
`ROUTE_AUDIT.md`, `QA_CHECKLIST.md`, `DATABASE_SCHEMA.md`,
`SUPABASE_RLS_PLAN.md`, `ENTITY_RELATIONSHIP.md`.

---

## Polimento UX/UI (Sprint 18)

Esta sprint foi exclusivamente de polimento visual, UX, acessibilidade
básica, responsividade e consistência geral. **Nenhuma funcionalidade
nova foi implementada, nenhum backend foi ligado, nenhuma regra de
negócio foi alterada.**

Pontos revisados:

- **Headers de página** — padrão consistente entre Área do usuário,
  Área do vendedor e Admin (título + subtítulo + badges de contexto).
- **Cards** — bordas, sombras, espaçamento e alinhamento de CTAs
  seguem o design system em `src/styles.css` (tokens semânticos).
- **Botões e CTAs** — primário/secundário/destructive vêm do shadcn
  Button; botões mockados sempre exibem toast (sonner), nunca ficam
  mudos.
- **Toasts** — mensagens curtas e profissionais em pt-BR. Erros
  técnicos ficam no console; a UI informa o usuário final.
- **EmptyStates** — reutilizam o componente `EmptyState` com ícone +
  título + descrição curta + CTA útil.
- **Skeletons** — `ProductSkeleton` e placeholders `animate-pulse`
  padronizados; nada de spinners genéricos.
- **Responsividade** — sidebars viram menu horizontal com scroll no
  mobile; tabelas admin/vendedor usam overflow-x elegante.
- **Tabelas mobile** — `SellerListingsTable`, tabelas admin e listas
  financeiras rolam horizontalmente com wrappers `overflow-x-auto`.
- **Acessibilidade básica** — botões ícone-only com `aria-label`,
  labels associadas a inputs, foco visível via Tailwind ring, uso de
  tokens `text-foreground` / `text-muted-foreground` para contraste
  adequado.
- **Microinterações** — Framer Motion apenas em entradas de seção e
  hovers de card, nada exagerado.
- **Copywriting** — "Modo demonstração" no lugar de "mockado",
  "Disponível em uma próxima etapa" no lugar de "funcionalidade
  futura", nas mensagens voltadas ao usuário final.
- **Badges de status** — mantidos com `AdminStatusBadge`,
  `AdminRiskBadge` e badges de produto (Ativo / Pausado / Esgotado /
  Indisponível) usando variantes shadcn.

O MVP está pronto para a etapa de preparação para
GitHub/Cursor/desenvolvedor.

---

## Regras de conta (Hotfix 18.1)

- Toda conta comum da LIT Buy é comprador **e** vendedor por padrão.
  Não há onboarding obrigatório de vendedor no MVP.
- `activeRole` alterna apenas o contexto visual (buyer/seller); não é
  permissão real e não bloqueia nada.
- `/vendedor` e `/vendedor/anuncios/novo` abrem para qualquer usuário
  logado — `AuthGate` exige apenas login.
- `/admin` continua protegido por `AdminGate` (login + `isAdmin`).
- No mock, `isAdmin: true` só é atribuído ao login demo
  `admin@litbuy.com`. Qualquer outro email loga como usuário comum.
- Tudo permanece em memória, sem `localStorage` e sem cookies.

---

## Regras de Marketplace Planejadas (Sprint 18.2)

Documentação estratégica de marketplace intermediador registrada nesta sprint. **Tudo documentado, nada implementado no backend** — o MVP atual permanece 100% mockado.

- **Fluxo de pedido** — `ORDER_LIFECYCLE.md` define 9 status (`pending_payment` → `refunded`) com quem vê, quem age e transições.
- **Entrega digital** — `DIGITAL_DELIVERY_FLOW.md` descreve fluxo de entrega, evidências obrigatórias e alertas de segurança.
- **Disputa** — `DISPUTE_FLOW.md` documenta 7 status, efeito no saldo e papel do admin.
- **Wallet / escrow** — `WALLET_AND_ESCROW_RULES.md` cobre bruto/taxa/líquido, pendente/disponível/bloqueado, saque e estorno.
- **Status de anúncio** — `LISTING_STATUS_RULES.md` lista 7 status, visibilidade e regra invariante (`active` + `stock > 0` para compra).
- **Regras de avaliação** — `REVIEW_RULES.md` amarra review a `order_item` de pedido `completed`.
- **Mensagens** — `MESSAGING_RULES.md` distingue pré-compra e pós-pedido, define moderação e evidência em disputa.
- **Admin / auditoria** — toda ação de admin gera `admin_audit_logs` imutável (ver `DATABASE_SCHEMA.md`).
- **Regras oficiais consolidadas** — `MARKETPLACE_RULES.md`.

Docs de suporte atualizados: `DATABASE_SCHEMA.md`, `ENTITY_RELATIONSHIP.md`, `SUPABASE_RLS_PLAN.md`, `PROJECT_RULES.md`.

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

## Pós-compra (Sprint 18.4)

- Novo `orderService` (`src/services/orderService.ts`) fornece pedidos mockados, timeline, entrega digital, disputa e avaliação.
- Nova rota `/pedidos/$id` protegida por `AuthGate`, com Breadcrumb, cabeçalho, timeline, itens, card de entrega digital, disputa e avaliação.
- `RecentOrdersCard` agora linka o botão "Ver detalhes" para `/pedidos/$id`.
- Componentes novos em `src/components/orders/`: `OrderHeader`, `OrderStatusBadge`, `OrderTimeline`, `OrderItemsList`, `DigitalDeliveryCard`, `OrderSecurityNotice`, `OrderActionsCard`, `OrderDisputeCard`, `OrderReviewCard`.
- Entrega digital: dados sensíveis ficam mascarados (`••••`) com blur; botão "Revelar" apenas mostra toast informando que dados reais exigem backend seguro. Nada é armazenado.
- Disputa: modal com motivo + descrição; envio é apenas `toast` via `orderService.simulateOpenDispute` — nenhuma persistência.
- Avaliação: só liberada quando `status === "completed"`; envio via `orderService.simulateSubmitReview` mostra toast — nenhuma nota é salva.
- Ação "Confirmar recebimento" é mockada e sinaliza que em produção o pagamento seria liberado ao vendedor.
- `/vendedor/vendas/$id` NÃO foi criada nesta sprint para manter baixo risco; a visão do vendedor sobre o pedido permanece como toast/documentação.
- Limitações: nenhum backend, nenhuma persistência, nenhum dado sensível real, nenhum pagamento real, nenhuma disputa real acionada.

## Mensagens (Sprint 18.5)

- Novo `messageService` (`src/services/messageService.ts`) fornece conversas, mensagens, contexto e envio simulado. Nenhuma rota consome mocks diretamente.
- Novos tipos: `Conversation`, `ConversationParticipant`, `ConversationMessage`, `ConversationContext`, `MessageAttachment`, `MessageStatus`, `ConversationType`.
- Nova rota `/mensagens/$id` protegida por `AuthGate`, com layout de lista + conversa aberta (desktop) e conversa empilhada (mobile).
- Rota `/mensagens` reescrita: agora mostra lista de conversas + painel vazio no desktop, orientando a seleção.
- Componentes novos em `src/components/messages/`: `ConversationsList`, `ConversationListItem`, `ConversationHeader`, `ConversationContextCard`, `MessagesThread`, `MessageBubble`, `MessageComposer`, `MessageEmptyState`, `MessageSecurityNotice`.
- Contexto da conversa: pré-compra mostra produto + botão "Ver produto"; pós-compra mostra pedido + botão "Ver pedido"; suporte mostra aviso oficial.
- Composer visual: envio simulado via `simulateSendMessage` adiciona a mensagem apenas em estado local (não persistido). Anexos e emojis exibem toast "Em breve".
- Aviso de segurança: destaque de que a conversa deve ficar na plataforma e que mensagens podem ser evidência em disputa.
- Integrações: `ContactSellerCard` (loja pública) e `OrderActionsCard` (pedido) agora linkam para `/mensagens`. `RecentMessagesCard` teve o botão "Abrir" convertido em Link para `/mensagens`.
- Limitações: nenhum backend, nenhum WebSocket, nenhum chat real, nenhum upload real, nenhuma notificação real, nenhuma persistência, nada em LocalStorage/Cookies, nenhuma moderação real.

## QA final (Sprint 18.6)

- Typecheck (`tsgo --noEmit`) passa limpo após todas as sprints 17→18.5.
- Rotas novas auditadas: `/buscar`, `/pedidos/$id`, `/mensagens/$id` (todas com `AuthGate` quando aplicável e `notFoundComponent` nos detalhes dinâmicos).
- Fluxos críticos verificados: busca global, pós-compra, entrega digital, disputa visual, avaliação visual, mensagens detalhadas, compra, carrinho, checkout, vendedor e admin.
- Nenhum backend, chat real, pagamento real, disputa real, upload real ou persistência foi introduzido.
- Projeto pronto para Sprint 19 — handoff técnico (GitHub/Cursor/desenvolvedor).

## Sprint 18.7 — Anúncio Avançado (concluída)

- Wizard de `/vendedor/anuncios/novo` evoluído para 6 etapas.
- Suporte visual a modelos Normal, Dinâmico e Serviço.
- Categoria + subcategoria, tipo de produto, atributos dinâmicos por jogo.
- Campos especiais para produto do tipo Conta.
- Imagem de capa separada da galeria (ambas via `ImageUploader` demo).
- Entrega Manual/Automática + Cofre Seguro mockado com preview mascarado.
- Planos de destaque Prata/Ouro/Diamante e plano LIT-MAX com mensagem automática.
- Preferências de notificação de venda (in-app, browser, e-mail futuro,
  integração externa futura).
- Novo service `listingDraftService` e novos tipos em `src/types/index.ts`.
- Typecheck limpo.

### Limitações atuais
- Sem backend, sem persistência (nem LocalStorage, nem Cookies).
- Sem upload real, sem cofre real, sem criptografia real.
- Sem envio de mensagem real, sem cobrança de plano, sem assinatura LIT-MAX real.

### Próximo passo sugerido
- Sprint 18.8 — Produto Dinâmico na página pública + Perguntas Públicas + Mini Cart.

## Sprint 18.8 — Produto Dinâmico, Perguntas Públicas e Mini Cart

- ProductCard suporta Normal, Dinâmico, Serviço (fixo/orçamento) e Moeda Virtual.
- Página /produto/$id mostra ProductDetailsSpecs, AccountInfoCard (quando aplicável),
  ProductVariantSelector, VirtualCurrencyQuoteBox e ProductQuestions.
- PurchaseCard integra variação selecionada, cotação de moeda virtual,
  fluxo de serviço sob orçamento e abre MiniCartModal após add válido.
- CartProvider aceita variação/cotação por chave composta sem persistência.
- MessageComposer e perguntas públicas usam censura visual mockada (moderation.ts).
- Typecheck limpo. Nenhum backend, nenhum LocalStorage, nenhum Cookie.

### Limitações conhecidas
- Moderação, cotação real, multi-vendedor e cofre automático exigem backend.
- Perguntas são in-memory: recarregar a página reseta a lista.

## Sprint 18.9 — Checkout Avançado + Pagamento Pendente

- `/checkout` reescrito: revisão, comprador, Proteção LIT, LIT Points,
  métodos de pagamento (Pix, Boleto, Cartão demo, Saldo LIT, LIT Points)
  com bloco específico por método, resumo com Proteção LIT/taxas/pontos.
- Serviço sob orçamento é bloqueado no checkout.
- `paymentService` mockado — nenhum pagamento real é criado.
- Rota `/pagamento/$id` exibe pagamento pendente (Pix, Boleto, Cartão,
  Saldo LIT, LIT Points) com QR fictício, linha digitável, contador,
  cópia mock, resumo financeiro e ganho de LIT Points.
- `/pedidos/$id` mostra badge de Proteção LIT ativa (mock) quando aplicável.
- `analyticsService` mockado com eventos `view_item`, `add_to_cart`,
  `begin_checkout`, `select_payment_method`, `add_protection_plan`,
  `generate_payment`, `purchase_mocked`, `search`, `create_listing_mocked`.
- Typecheck limpo. Nenhum backend, LocalStorage ou Cookie.

### Limitações conhecidas
- Pagamentos, carteira e LIT Points são visuais/in-memory (Map).
- Cartão nunca é coletado; boleto e Pix não são reais.
- Analytics não envia eventos — apenas `console.debug` em dev.

## Sprint 18.10 — LIT Points, Tarifas, Prazos e Níveis de Vendedor

- Programa LIT Points é próprio da LIT Buy. Não é dinheiro, não é saldo financeiro, não pode ser sacado.
- Rotas públicas `/lit-points` e `/taxas` explicam programa, tarifas, prazos e níveis de vendedor.
- Níveis Bronze/Prata/Ouro/Diamante/Elite são visuais e mockados.
- Taxas e prazos exibidos são demonstrativos. Cálculo real, cobrança, split, escrow, saques e assinatura LIT-MAX exigem backend.
- Saldo LIT é separado de LIT Points. Saldo pendente/disponível/bloqueado é apenas visual.
- Services: `litPointsService`, `sellerLevelService`, `platformEconomicsService` — todos mockados, sem persistência.
- Integrações leves em `/carteira`, `/vendedor`, `/vendedor/financeiro`, `/loja/$slug` e `/produto/$id`.
- Footer aponta para `/lit-points` e `/taxas`.

## Sprint 18.11 — Verificação/KYC + Equipe do Vendedor
- Fluxo visual de KYC (`/perfil/verificacao`) com etapas Dados básicos, SMS, Documento, Selfie e Revisão — 100% mockado.
- `verificationService` centraliza status, etapas, documentos aceitos, timeline e simulações.
- Selo "Vendedor Verificado" via `SellerVerificationBadge` em `/loja/$slug` e `/produto/$id`.
- Card de verificação em `/perfil` e `/vendedor` (não bloqueia acessos).
- Aviso discreto de verificação no wizard `/vendedor/anuncios/novo` (não bloqueia criação).
- Nova rota `/vendedor/equipe` com membros, convites, cargos, matriz de permissões e atividade — todos mockados.
- `sellerTeamService` com métodos de convite/atualização/remoção simulados.
- Limitações: nenhum KYC real, sem upload, sem RBAC, sem envio de e-mail, sem persistência.

## Sprint 18.12 — Admin Avançado / Configurações Gerenciáveis
- Novas rotas: `/admin/catalogo`, `/admin/permissoes`, `/admin/verificacoes`, `/admin/financeiro`, `/admin/conteudo`, `/admin/relatorios`, `/admin/auditoria` — todas mockadas.
- `adminAdvancedService` centraliza categorias/subcategorias, permissões, roles, KYC queue, taxas, métodos de pagamento, LIT Points, níveis, planos, feature flags, páginas de conteúdo, relatórios e audit log.
- Dashboard `/admin` ganha bloco de ações rápidas.
- `/admin/configuracoes` ganha aba de Feature Flags mockadas.
- `AdminSidebar` reorganizado em grupos: Operação · Pessoas · Plataforma.
- Limitações: nada é persistido; RBAC, feature flags, CMS, taxas e audit log reais exigem backend.

## Sprint 18.13 — Detalhe da Venda, Chat do Pedido, Entrega e Mediação (mock)

- Pagamento aprovado (mock) formaliza a criação de uma conversa vinculada ao pedido (`order_related`), acessível em `/pedidos/$id` e em `/mensagens/$id`.
- Chat do pedido é o canal oficial para entrega, suporte e mediação. Conversa fora da plataforma reduz proteção futura.
- Entrega manual e entrega automática são exibidas de forma **visual/mockada** (nunca revelam dados reais). Cofre e criptografia reais exigem backend.
- Central de Mediação (mock) cobre motivos, provas, réplica do vendedor, timeline e trechos do chat como evidência.
- Rota `/vendedor/vendas/$id` mostra a visão do vendedor: comprador, produto, pagamento, entrega, chat, financeiro, timeline e mediação.
- Services: `sellerSaleService`, extensões em `orderService` e `messageService`; nenhum dado é persistido.
- Confirmação de recebimento, liberação de saldo, uploads reais e decisões de mediação **só podem ocorrer no backend real**.
