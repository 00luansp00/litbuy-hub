# DEVELOPER_HANDOFF.md — LIT Buy

Este é o documento principal de entrega técnica para desenvolvedor,
freelancer ou agência assumir o projeto.

## 1. Visão geral

**LIT Buy** é um marketplace premium de produtos digitais e games,
com foco em contas, gift cards, moedas virtuais, skins e serviços.

Atores:

- **Comprador**: navega, compra, favorita, avalia.
- **Vendedor**: cria anúncios (normal / dinâmico / serviço), gerencia
  vendas, finanças, equipe.
- **Admin**: modera catálogo, denúncias, disputas, KYC, financeiro,
  relatórios.

Funcionalidades presentes visualmente:

- Anúncios normais, dinâmicos (com variações) e serviços sob orçamento.
- Checkout mockado com Pix, boleto, cartão, saldo LIT, LIT Points e
  Proteção LIT.
- Pedidos com timeline, chat oficial, mediação guiada.
- Denúncias (Central de Mediação) em produto, loja, mensagem, pedido e
  venda.
- Notificações no sino + `/notificacoes`.
- Afiliados LIT Buy visuais (link, conversões, comissões, saque).
- E-mails transacionais visuais + preferências de comunicação.
- Páginas públicas de confiança (Ajuda, Termos, Privacidade, etc.).
- Admin painel completo (usuários, vendedores, anúncios, pedidos,
  transações, disputas, denúncias, catálogo, permissões, verificações,
  financeiro, conteúdo, relatórios, auditoria).
- KYC visual (SMS, documento, selfie).
- Equipe do vendedor (cargos e convites mockados).

## 2. Estado atual

- Frontend avançado, MVP visual/mockado.
- **Sem backend real.**
- **Sem banco de dados.**
- **Sem autenticação real** (login demo em memória).
- **Sem pagamento real** (Pix/boleto/cartão gerados como mock).
- **Sem persistência** (nada em LocalStorage/Cookies).
- Pronto para iniciar a fase backend (ver `BACKEND_ROADMAP.md`).

## 3. Stack

- **React 19** + **TypeScript** (strict).
- **Vite 7** + **TanStack Start / Router** (file-based).
- **Tailwind v4** + **shadcn/ui** (Radix).
- **Framer Motion** para animações leves.
- **Lucide Icons** para iconografia.
- **TanStack Query** para cache de dados.
- **Zod** + **react-hook-form** para formulários.
- **sonner** para toasts.
- Services mockados em `src/services/`.
- Providers globais em `src/providers/`.
- Documentação em Markdown na raiz.

## 4. Como rodar

Requer **Bun** (recomendado) ou npm/pnpm.

```bash
bun install
bun run dev        # dev server (Vite)
bun run build      # build produção
bun run build:dev  # build em modo desenvolvimento
bun run preview    # preview do build
bun run lint       # ESLint
bunx tsgo --noEmit # typecheck (sem script dedicado)
bun run format     # Prettier
```

## 5. Login demo

Autenticação é **mockada em memória** (`AuthProvider` + `authMock`).

- Qualquer e-mail/senha loga como usuário comum.
- Para acessar o painel admin, use o e-mail **`admin@litbuy.com`**
  (senha qualquer). O `AdminGate` é apenas visual.
- Todo usuário comum pode **comprar e vender** — os papéis "comprador"
  e "vendedor" são apenas contexto visual (`activeRole`).
- Nenhum dado real é coletado ou persistido.

## 6. Regra principal

- **Frontend NÃO é fonte de verdade.**
- Toda validação real deve viver no backend.
- Permissões, papéis e RBAC precisam de RLS/checks server-side.
- **Dinheiro, saldo, escrow, pagamento e comissão jamais podem depender
  do frontend.**
- Precisa RLS (Row Level Security) ou equivalente, auditoria, logs
  imutáveis, idempotência de pagamento e antifraude.

## 7. Próxima fase recomendada

Ordem sugerida:

1. Revisar o projeto no **Cursor** (ou IDE preferida).
2. Subir para o **GitHub**.
3. Definir backend (assumido: **Supabase** — ver `SUPABASE_RLS_PLAN.md`
   e `DATABASE_SCHEMA.md`).
4. Implementar banco conforme `DATABASE_IMPLEMENTATION_NOTES.md`.
5. Implementar **autenticação real** (Supabase Auth + verificação de
   e-mail + 2FA).
6. Implementar **RBAC + RLS** (`SUPABASE_RLS_PLAN.md`).
7. Implementar catálogo real (produtos, categorias, imagens, aprovação).
8. Implementar pedidos, chat, mediação real.
9. Implementar **pagamento e escrow** (`PAYMENT_AND_ESCROW_IMPLEMENTATION_PLAN.md`)
   — parte mais crítica.
10. Implementar wallet real, saques e KYC real.
11. Implementar admin real com auditoria imutável.
12. Implementar e-mails transacionais reais (Resend/SendGrid/SES).
13. Reforçar segurança (`SECURITY_IMPLEMENTATION_PLAN.md`).
14. Avaliar SSR/SSG para SEO das rotas públicas.
15. Configurar monitoramento, backups, LGPD, termos jurídicos.
16. **Deploy** (Cloudflare/Vercel/Netlify + Supabase managed).

## Documentos relacionados

- `ROUTES_MAP.md`
- `SERVICES_MAP.md`
- `PROVIDERS_MAP.md`
- `MOCKS_INVENTORY.md`
- `BACKEND_ROADMAP.md`
- `API_CONTRACTS_DRAFT.md`
- `DATABASE_SCHEMA.md` + `DATABASE_IMPLEMENTATION_NOTES.md`
- `SECURITY_IMPLEMENTATION_PLAN.md`
- `PAYMENT_AND_ESCROW_IMPLEMENTATION_PLAN.md`
- `TECH_DEBT_AND_RISKS.md`
- `HANDOFF_CHECKLIST.md`
- `PRE_HANDOFF_AUDIT.md`
- `ARCHITECTURE.md`, `PROJECT_RULES.md`, `MVP_STATUS.md`

## Sprint 2C2B1 — autenticação central do frontend (2026-07-15, PR #9)

- O frontend passa a chamar exclusivamente a API NestJS em `VITE_API_BASE_URL` para cadastro, verificação de e-mail, login, aprovação de dispositivo, login 2FA, recuperação/redefinição de senha, refresh, logout e `/auth/me`.
- Access tokens ficam apenas em memória; refresh token, device cookie e CSRF cookie continuam sob controle do backend. O frontend lê somente `litbuy_csrf` e envia `X-CSRF-Token` em mutações.
- Perfil, CPF, vendedor real, RBAC, gestão de sessões/dispositivos, alteração autenticada de senha e 2FA de gerenciamento permanecem para Sprint 2C2B2+.
- Supabase não é arquitetura obrigatória para autenticação; a fonte de verdade é a API NestJS `/api/v1`.
- Para desenvolvimento local: subir PostgreSQL e Redis do backend, `cd backend && bun install && bun run prisma:migrate:deploy && bun run dev`; em outro terminal, na raiz, `bun install && bun run dev`.

## Sprint 2C2B2A — Central de Segurança da Conta

- Frontend integrado aos endpoints reais NestJS `/auth/sessions`, `/auth/sessions/:sessionId`, `/auth/sessions/logout-all`, `/auth/devices`, `/auth/devices/:deviceId` e `/auth/password/change`.
- Nova rota autenticada `/perfil/seguranca` usa o layout de perfil existente para sessões ativas, dispositivos aprovados e alteração autenticada de senha.
- A página usa TanStack Query com chaves privadas `['auth','sessions']` e `['auth','devices']`, sem persistir access token, senha, IDs de sessão/dispositivo em storage, analytics ou URL pública.
- Alteração de senha segue o contrato real `{ currentPassword, newPassword }`; o backend revoga todas as sessões e o frontend limpa autenticação local e redireciona para login.
- Revogar a sessão atual ou o dispositivo atual limpa access token em memória, usuário e queries privadas; revogar uma sessão/dispositivo não atual apenas invalida as listas. O endpoint `/auth/sessions/logout-all` é tratado como logout de todas as sessões, incluindo a atual.
- Telefone, e-mail de gerenciamento, 2FA de gerenciamento, recovery codes e Sprint 2C2B2B permanecem fora do escopo.

## Sprint 2C2B2B1 — telefone seguro e alteração de e-mail

- Frontend integrou os contratos reais `POST /auth/phone/request`, `POST /auth/phone/verify`, `POST /auth/email/change/request` e `POST /auth/email/change/confirm` usando `apiFetch`, bearer em memória, cookies `include` e CSRF para métodos inseguros.
- `/perfil/seguranca` segue como Central de Segurança e agora inclui cards dedicados para telefone e e-mail. Challenge de telefone, SMS code, senha, novo e-mail e token de confirmação não são persistidos.
- `/confirmar-alteracao-email` remove imediatamente `token` da URL com navegação `replace`, exige o novo e-mail novamente para funcionar em nova aba, consome o token uma única vez e trata `PENDING` e `COMPLETED`.
- `COMPLETED` de alteração de e-mail e sucesso de telefone encerram a autenticação local, removem queries privadas e direcionam para `/login`, alinhado à revogação de sessões e limpeza de cookies do backend.
- Gerenciamento de 2FA continua fora de escopo e pendente para Sprint 2C2B2B2.
