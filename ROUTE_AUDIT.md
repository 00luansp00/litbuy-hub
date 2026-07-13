# ROUTE_AUDIT.md — LIT Buy

Auditoria técnica de rotas, links e navegação (Hotfix 16.2).
Nenhuma nova funcionalidade foi implementada. Apenas verificação e correção
de navegação. Toda persistência, backend e autenticação continuam mockados.

## 1. Estrutura de rotas

Convenção usada: **file-based routing** com pontos como separadores
(`vendedor.anuncios.novo.tsx` → `/vendedor/anuncios/novo`). O arquivo
`src/routeTree.gen.ts` é gerado automaticamente e **não deve ser editado**.

### Rotas pai com filhos (precisam de `<Outlet />`)

| Rota pai                    | Arquivo                        | `<Outlet />` | Status |
|-----------------------------|--------------------------------|--------------|--------|
| `/admin`                    | `admin.tsx`                    | Sim (dentro de `AdminGate`) | OK |
| `/vendedor`                 | `vendedor.tsx`                 | Sim          | OK |
| `/vendedor/anuncios`        | `vendedor.anuncios.tsx`        | Sim (corrigido no hotfix 16.1) | OK |

Conteúdo da listagem de anúncios foi movido para
`vendedor.anuncios.index.tsx` para que `/vendedor/anuncios/novo` renderize
corretamente dentro do `<Outlet />` do pai.

Nenhuma outra rota pai possui filhos.

## 2. Rotas auditadas

### Área do vendedor
- `/vendedor` → dashboard (`vendedor.index.tsx`) — OK
- `/vendedor/anuncios` → listagem (`vendedor.anuncios.index.tsx`) — OK
- `/vendedor/anuncios/novo` → wizard mockado — OK
- `/vendedor/vendas` — OK
- `/vendedor/financeiro` — OK
- `/vendedor/avaliacoes` — OK

Todas as rotas estão protegidas por `AuthGate`. Sidebar
(`SellerDashboardSidebar`) destaca a rota ativa via `currentPath`.

### Área admin
- `/admin` (index) — OK
- `/admin/usuarios`, `/admin/vendedores`, `/admin/anuncios`,
  `/admin/pedidos`, `/admin/transacoes`, `/admin/disputas`,
  `/admin/denuncias`, `/admin/configuracoes` — OK

Protegido por `AdminGate`. Sidebar (`AdminSidebar`) destaca item ativo.
CTA "Voltar ao marketplace" aponta para `/`.

### Área do usuário
- `/perfil`, `/pedidos`, `/favoritos`, `/mensagens`, `/carteira` — OK
- CTA "Vender na LIT Buy" (em `AccountSidebar`) aponta para `/vendedor`.

### Público
- `/`, `/produto/$id`, `/categoria/$slug`, `/loja/$slug` — OK
- `/carrinho`, `/checkout` — OK
- `/login`, `/cadastro`, `/recuperar-senha` — OK

## 3. Componentes de navegação verificados

| Componente                           | Situação |
|--------------------------------------|----------|
| `Navbar`                             | Links via `<Link to=...>`; carrinho aponta para `/carrinho` com contador. |
| `UserMenu`                           | Comprador e vendedor com opções corretas; `isAdmin` mostra "Painel administrativo". Trocas de papel são mockadas com `toast`. |
| `AccountSidebar`                     | Todos os itens da área do usuário; CTA vendedor OK. |
| `SellerDashboardSidebar`             | Todos os itens da área do vendedor; loja pública quando `slug` disponível; CTA volta para `/perfil`. |
| `SellerDashboardHeader`              | Botão "Criar anúncio" aponta para `/vendedor/anuncios/novo`; "Ver loja pública" para `/loja/$slug`. |
| `SellerQuickActions`                 | Atalhos para criar anúncio, vendas, financeiro. |
| `AdminSidebar`                       | Todos os itens admin + "Voltar ao marketplace". |
| `Hero` (home)                        | "Quero vender" aponta para `/vendedor`. |
| `ProductCard`                        | Abre `/produto/$id`; bloqueia adicionar ao carrinho se indisponível. |
| `CategoryCard`                       | Abre `/categoria/$slug`. |
| `SellerInfo`                         | Abre `/loja/$slug`. |
| `PurchaseCard`                       | Bloqueia compra/carrinho para indisponíveis. |
| `Cart*` (empty/summary)              | "Continuar comprando" → `/`; "Ir para checkout" → `/checkout` só com itens. |
| `Checkout*`                          | "Editar carrinho" → `/carrinho`; sucesso → `/pedidos` ou `/`. |

## 4. Problemas encontrados e corrigidos

1. **`/vendedor/anuncios/novo` não renderizava** — o pai
   `vendedor.anuncios.tsx` não tinha `<Outlet />` e continha a página de
   listagem. **Correção**: transformado em layout com `<Outlet />` e
   listagem movida para `vendedor.anuncios.index.tsx`.
   *(Hotfix 16.1 / 16.2)*

Nenhum outro caso de rota pai sem `<Outlet />` foi encontrado.
Nenhum link para rota inexistente foi encontrado.

## 5. Ações mockadas conhecidas (mantidas)

- Login, cadastro, recuperar senha (autenticação mockada).
- Criar/publicar anúncio (wizard visual, nenhum upload/persistência real).
- Troca de papel comprador/vendedor (in-memory).
- Checkout: nenhum pagamento real.
- Todas as ações administrativas (aprovar, suspender, exportar): `toast`.
- Editar perfil, seguir vendedor, enviar mensagem: `toast`.

## 6. Placeholders ativos

Nenhum arquivo em `src/routes/` usa `PlaceholderPage` atualmente. O
componente existe e continua disponível para eventuais novas rotas em
construção.

## 7. Observações para QA manual

- Testar navegação profunda: `/vendedor` → sidebar → cada subrota.
- Testar navegação profunda: `/admin` → sidebar → cada subrota.
- Testar botão "Criar anúncio" a partir do header, sidebar e quick actions.
- Testar UserMenu nos dois modos (comprador/vendedor) e com `isAdmin`.
- Testar fluxo de compra: home → produto → carrinho → checkout → sucesso.
- Testar produto indisponível: adicionar ao carrinho deve bloquear.
- Testar checkout com item indisponível: finalização bloqueada.

## Sprint 18.6 — auditoria pós-mensagens

- `/buscar` — pública, sem `AuthGate`, usa `searchService`.
- `/pedidos` — protegida por `AuthGate`, lista via `orderService`.
- `/pedidos/$id` — protegida por `AuthGate`, `notFoundComponent`, timeline + entrega + disputa + avaliação.
- `/mensagens` — protegida por `AuthGate`, lista de conversas via `messageService`.
- `/mensagens/$id` — protegida por `AuthGate`, `notFoundComponent`, contexto de produto/pedido/suporte + composer mockado.
- `/vendedor/*` — protegida por `AuthGate`, todos usuários logados podem acessar.
- `/admin/*` — protegida por `AdminGate` (checa `isAdmin` via `admin@litbuy.com`).
- Todas as rotas dinâmicas usam `Link` com `params={{ ... }}` — nenhum `href` interpolado.
- Nenhuma rota consome `@/data/*` diretamente — sempre via services.

## Sprint 18.20 — Auditoria leve
- `/admin/denuncias` é a rota oficial (não existe `/admin/reclamacoes`).
  Links em Footer, Notificações, ReportDialog e AdminSidebar apontam
  para `/admin/denuncias`.
- Rotas de e-mail: `/verificar-email`, `/redefinir-senha`,
  `/verificacao-login`, `/perfil/preferencias` — sem quebras.
- Páginas públicas (Sprint 18.17): `/ajuda`, `/como-comprar`,
  `/como-vender`, `/seguranca`, `/regras-da-plataforma`,
  `/itens-proibidos`, `/politica-de-reembolso`, `/termos`,
  `/privacidade`, `/contato` — todas presentes.
- `/afiliados` acessível via Footer e AccountSidebar.
- 404 amigável no root (`notFoundComponent`).

## Sprint 18.21 — Auditoria final pré-handoff

- 66 rotas geradas em `src/routes/`.
- Todas as rotas listadas em `PRE_HANDOFF_AUDIT.md` carregam sem erro.
- `/admin/denuncias` é oficial. `rg "admin/reclamacoes" src/` → 0 hits.
- Nenhum import inválido de `lucide-react/dynamic`.
- 404 amigável em `__root.tsx` (`notFoundComponent`).
- ErrorBoundary e OfflineNotice envolvem toda a árvore autenticada.
