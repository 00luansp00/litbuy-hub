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
- Componentes de feature vivem em `src/components/<feature>/` (ex.: `home/`, `auth/`, `layout/`).

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

## 7. Restrições até nova ordem

Não implementar nesta fase:

- Backend, banco de dados, APIs reais
- Autenticação real, OAuth, providers sociais
- Pagamentos, lógica financeira, checkout real
- Mensageria, uploads reais, notificações push

## 8. Qualidade

- Preserve acessibilidade: `aria-label`, foco visível, contraste.
- Animações discretas via `motion` (framer-motion) — nunca exageradas.
- Toda tela deve funcionar em mobile, tablet e desktop.
- Zero `console.log` em produção; use os utilitários de log/erro existentes.

## 9. Documentação

- Toda sprint que introduzir um módulo novo deve atualizar `ARCHITECTURE.md`.
- Decisões arquiteturais relevantes devem ser registradas neste arquivo ou em ADRs futuros.
