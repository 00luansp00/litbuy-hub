# LIT Buy — Project Rules

Regras obrigatórias para qualquer desenvolvedor(a) ou agente que contribuir com o projeto LIT Buy. O objetivo é preservar a qualidade arquitetural e a identidade visual do marketplace ao longo de dezenas de sprints.

## 1. Princípios gerais

- **Evoluir, nunca recriar.** O projeto continua entre sprints; nunca reestruture o que já funciona.
- **Reutilizar antes de criar.** Consulte `src/components/` antes de introduzir qualquer componente novo.
- **TypeScript sempre.** Nada de `any` implícito; prefira tipos em `src/types/`.
- **Escalabilidade primeiro.** Toda nova feature deve caber na arquitetura existente sem gambiarras.

## 2. Componentização

- Nunca duplique componentes. Se existir um `ProductCard`, `SectionHeader`, `AuthCard`, etc., estenda-os por props.
- Componentes de UI baixo-nível vivem em `src/components/ui/` (shadcn) — **não editar diretamente** salvo bugfix.
- Componentes reutilizáveis de domínio vivem em `src/components/common/`.
- Componentes de feature vivem em `src/components/<feature>/` (ex.: `home/`, `auth/`, `layout/`, `product/`, `seller/`).

### Convenções de rota — vendedor

- **`/vendedor`** é reservada para o **painel do vendedor** (área logada, futura sprint). Não usar para perfil público.
- **`/loja/$slug`** é o **perfil público** da loja/vendedor. Consome `sellerService`.

## 3. Identidade visual

- Utilize sempre os tokens semânticos definidos em `src/styles.css` (`bg-background`, `text-foreground`, `bg-primary`, `text-gradient`, `shadow-elegant`, `bg-hero`, `container-lit`, etc.).
- **Nunca** utilize cores hardcoded (`text-white`, `bg-[#...]`, `bg-black`) em componentes de aplicação.
- Fontes: `Sora` para títulos, `Inter` para corpo. Não introduzir novas famílias sem aprovação.
- Tema dark-first. Nunca alterar a identidade visual sem solicitação explícita do produto.

## 4. Rotas

- Rotas ficam em `src/routes/` usando `createFileRoute` do TanStack Router.
- Nunca editar `src/routeTree.gen.ts` — é gerado.
- Toda rota de placeholder deve usar `PlaceholderPage` com título e ícone dedicados.

## 5. Dados

- Dados mockados vivem em `src/data/`.
- Nenhuma feature pode importar dados diretamente de componentes; passe via props ou service.
- Chamadas simuladas passam pelos services em `src/services/`, sempre assíncronas, prontas para virarem HTTP.

## 6. Estado & Auth

- Autenticação atual é **mock em memória** (`src/services/authMock.ts` + `AuthProvider`). Zero LocalStorage, cookies, JWT ou backend.
- Novas features que dependem de sessão devem consumir `useAuth()` e nunca criar seu próprio estado paralelo.

## 7. Dados e acesso

- **Nunca** acessar mocks de `src/data/` diretamente em páginas ou componentes. Sempre consumir via `src/services/*`.
- Toda leitura/escrita de dados passa por um service assíncrono — mesmo que hoje resolva localmente.
- Novos services devem usar assinaturas compatíveis com uma futura API HTTP/Supabase (async, retornando `Promise`, aceitando parâmetros serializáveis).
- Toda nova entidade deve ser compatível com o contrato definido em `DATABASE_SCHEMA.md` e `ENTITY_RELATIONSHIP.md`.

## 8. Restrições até nova ordem

Não implementar nesta fase:

- Backend, banco de dados, APIs reais
- Supabase (client, migrations, políticas) — apenas em sprint dedicada, seguindo `SUPABASE_RLS_PLAN.md`
- Autenticação real, OAuth, providers sociais
- Pagamentos, lógica financeira, checkout real, cálculo de saldo no frontend
- Mensageria, uploads reais, notificações push
- Regras de segurança implementadas apenas no cliente — segurança é responsabilidade do backend (RLS / server functions)

Toda funcionalidade sensível (pagamentos, disputas, movimentação de carteira, admin) deve ser **planejada em documentação** antes de qualquer linha de código.

## 9. Qualidade

- Preserve acessibilidade: `aria-label`, foco visível, contraste.
- Animações discretas via `motion` (framer-motion) — nunca exageradas.
- Toda tela deve funcionar em mobile, tablet e desktop.
- Zero `console.log` em produção; use os utilitários de log/erro existentes.

## 10. Documentação

- Toda sprint que introduzir um módulo novo deve atualizar `ARCHITECTURE.md`.
- Toda nova entidade de dados deve ser refletida em `DATABASE_SCHEMA.md`, `ENTITY_RELATIONSHIP.md` e, se aplicável, `SUPABASE_RLS_PLAN.md`.
- Decisões arquiteturais relevantes devem ser registradas neste arquivo ou em ADRs futuros.


## Regras adicionais (pós-Sprint 14)

- A mesma conta pode ter papel comprador e vendedor. `activeRole` é 100% mockado em memória — nunca persistir em LocalStorage, cookies ou backend nesta fase.
- O `ImageUploader` atual é apenas visual: **nenhum upload real, nenhuma persistência, nenhum Storage**. Substituição por uploader real deve preservar a API do componente.
- Produtos com `stock <= 0` ou `status === "paused"` são considerados indisponíveis. Não podem ser adicionados ao carrinho e não podem finalizar checkout.
- Regras reais de estoque, reserva e validação de disponibilidade devem viver no backend futuramente — o mock atual serve apenas para preparar a UI.

## Painel Administrativo

- Ações administrativas reais exigem backend — não podem ocorrer no frontend.
- `AdminGate` é proteção visual apenas, não é segurança real.
- Permissões reais (RBAC), moderação, suspensão de contas, resolução de disputas e movimentações financeiras devem ser implementadas no backend.
- Nenhum dado exibido no painel deve ser persistido, exportado ou transmitido para serviços externos enquanto o backend não existir.
- Páginas em `/admin/*` devem consumir apenas `adminService`, nunca mocks diretamente.
