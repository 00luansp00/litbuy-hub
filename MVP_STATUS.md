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
