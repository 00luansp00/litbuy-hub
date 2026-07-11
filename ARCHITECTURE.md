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
