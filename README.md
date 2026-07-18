# LIT Buy

> **⚠️ MVP visual/mockado** — Este projeto é um MVP visual/mockado.
> **Não possui backend, pagamento real, autenticação real, envio de
> e-mail, upload ou persistência.** Serve como base visual e
> documental para a próxima fase de desenvolvimento real.

Marketplace premium para gamers e criadores digitais: contas, gift
cards, moedas virtuais, skins e serviços com pagamento protegido e
entrega instantânea (fluxo visual).

## Status atual

- ✅ Frontend avançado (React 19 + TanStack Start + Tailwind + shadcn/ui).
- ✅ MVP visual completo (home, catálogo, checkout, pedidos, chat,
  mediação, denúncia, afiliados, notificações, e-mails, admin, KYC).
- ✅ Documentação de arquitetura, rotas, services, providers, backend
  roadmap, contratos de API, banco, segurança, pagamentos.
- ❌ Backend, banco, autenticação, pagamento, upload — todos ausentes
  (por design).
- ✅ Typecheck limpo.
- ✅ Pronto para handoff técnico (GitHub / Cursor / desenvolvedor).

## Stack

- **React 19** + **TypeScript strict**
- **Vite 7** + **TanStack Start / Router**
- **Tailwind v4** + **shadcn/ui** (Radix)
- **TanStack Query**, **react-hook-form**, **Zod**, **Framer Motion**,
  **Lucide**, **sonner**

## Como rodar

```bash
bun install
bun run dev         # dev server
bun run build       # build produção
bun run build:dev   # build modo dev
bun run preview     # preview do build
bun run lint        # ESLint
bunx tsgo --noEmit  # typecheck
bun run format      # Prettier
```

## Login demo

- **Usuário comum**: qualquer e-mail/senha loga.
- **Admin**: `admin@litbuy.com` (senha qualquer).
- Autenticação é 100% mockada em memória — recarregar a página desloga.

## Estrutura de pastas

```
src/
├── components/       # UI por área (admin, seller, product, etc.)
│   ├── ui/           # shadcn primitives
│   ├── common/       # EmptyState, ProductCard, etc.
│   ├── error/        # ErrorBoundary
│   ├── status/       # OfflineNotice, RetryState
│   └── seo/          # buildSeoHead
├── routes/           # file-based routing (TanStack)
├── providers/        # AuthProvider, CartProvider, NotificationProvider
├── services/         # todos os mocks (productService, cartService, …)
├── data/             # produtos, categorias, sellers estáticos
├── types/            # tipos compartilhados
├── lib/              # utils, format, error-page
└── styles.css        # Tailwind + tokens
```

## Rotas principais

- **Públicas**: `/`, `/buscar`, `/produto/$id`, `/categoria/$slug`,
  `/loja/$slug`, `/afiliados`, `/ajuda`, `/como-comprar`, `/termos`,
  `/privacidade`, `/contato`, …
- **Comprador**: `/perfil`, `/pedidos`, `/carrinho`, `/checkout`,
  `/pagamento/$id`, `/mensagens`, `/notificacoes`, …
- **Vendedor**: `/vendedor`, `/vendedor/anuncios`, `/vendedor/vendas/$id`,
  `/vendedor/financeiro`, `/vendedor/equipe`, …
- **Admin**: `/admin`, `/admin/denuncias` (**oficial**),
  `/admin/pedidos`, `/admin/relatorios`, `/admin/auditoria`, …

Mapa completo em [`ROUTES_MAP.md`](./ROUTES_MAP.md).

## Documentos principais

Para desenvolvedor entrar rápido no projeto:

1. [`DEVELOPER_HANDOFF.md`](./DEVELOPER_HANDOFF.md) — comece por aqui.
2. [`ROUTES_MAP.md`](./ROUTES_MAP.md)
3. [`SERVICES_MAP.md`](./SERVICES_MAP.md)
4. [`PROVIDERS_MAP.md`](./PROVIDERS_MAP.md)
5. [`MOCKS_INVENTORY.md`](./MOCKS_INVENTORY.md)
6. [`BACKEND_ROADMAP.md`](./BACKEND_ROADMAP.md)
7. [`API_CONTRACTS_DRAFT.md`](./API_CONTRACTS_DRAFT.md)
8. [`DATABASE_SCHEMA.md`](./DATABASE_SCHEMA.md)
   - [`DATABASE_IMPLEMENTATION_NOTES.md`](./DATABASE_IMPLEMENTATION_NOTES.md)
9. [`SECURITY_IMPLEMENTATION_PLAN.md`](./SECURITY_IMPLEMENTATION_PLAN.md)
10. [`PAYMENT_AND_ESCROW_IMPLEMENTATION_PLAN.md`](./PAYMENT_AND_ESCROW_IMPLEMENTATION_PLAN.md)
11. [`TECH_DEBT_AND_RISKS.md`](./TECH_DEBT_AND_RISKS.md)
12. [`HANDOFF_CHECKLIST.md`](./HANDOFF_CHECKLIST.md)
13. [`PRE_HANDOFF_AUDIT.md`](./PRE_HANDOFF_AUDIT.md)
14. [`ARCHITECTURE.md`](./ARCHITECTURE.md),
    [`PROJECT_RULES.md`](./PROJECT_RULES.md),
    [`MVP_STATUS.md`](./MVP_STATUS.md),
    [`EDGE_CASES.md`](./EDGE_CASES.md),
    [`ANALYTICS_EVENTS.md`](./ANALYTICS_EVENTS.md)

## Regra principal

**Frontend NÃO é fonte de verdade.** Toda validação, permissão, cálculo
de dinheiro, escrow, KYC e antifraude deve viver no backend com RLS,
auditoria e testes. Ver `SECURITY_IMPLEMENTATION_PLAN.md` e
`PAYMENT_AND_ESCROW_IMPLEMENTATION_PLAN.md`.

## Aviso de demonstração

Enquanto os domínios de marketplace ainda forem mockados, **não insira dados reais** (cartão,
CPF, documento, selfie, senha, Pix, credenciais de jogo). Todas as
telas sensíveis de marketplace exibem aviso de demonstração; o backend real de autenticação já existe para os fluxos auditados.

## Authentication staging readiness

A staging simulation is available through `docker-compose.staging.yml` for frontend, backend, PostgreSQL and Redis. The current frontend build is produced by the Lovable/TanStack Start Vite configuration under `.output/`; the staging Docker image serves `.output/public` statically for rehearsal only. It is not a public deployment blueprint.

1. Copy and review `backend/.env.staging.example` for real staging or use `backend/.env.staging.local.example` only for isolated local smoke tests.
2. Run backend migrations with `cd backend && bun run prisma:generate && bun run prisma:migrate:deploy`.
3. Start local staging simulation with `docker compose -f docker-compose.staging.yml up --build`.
4. Validate `GET /api/v1/health/live`, `GET /api/v1/health/ready`, and `bun run smoke:infra`. Full auth flows remain covered by backend e2e/integration tests and manual homologation.
5. Follow `AUTH_STAGING_HOMOLOGATION_RUNBOOK.md` before considering staging approved.
