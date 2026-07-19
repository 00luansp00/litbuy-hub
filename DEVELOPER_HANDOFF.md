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
- Backend NestJS/PostgreSQL/Redis real existe para autenticação conforme `AUTHENTICATION_FINAL_AUDIT.md`.
- Banco real existe para autenticação; domínios de marketplace ainda dependem de modelagem/persistência própria.
- Autenticação real existe para cadastro, login, sessão, dispositivos, senha, e-mail, telefone, 2FA, step-up e recovery codes.
- **Sem pagamento real** (Pix/boleto/cartão gerados como mock).
- Domínios de marketplace ainda não têm persistência real. Autenticação usa PostgreSQL/Redis e cookies backend de refresh, dispositivo e CSRF; o access token fica somente em memória.
- O backend de autenticação já existe; a próxima fase backend é para domínios de marketplace como catálogo, pedidos, pagamentos, seller/admin, KYC e wallet (ver `BACKEND_ROADMAP.md`).

## 3. Stack

- **React 19** + **TypeScript** (strict).
- **Vite** + **TanStack Router** (file-based).
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

## 5. Autenticação real e papéis visuais

Autenticação não usa mais `authMock`: o bloco real está documentado em `AUTHENTICATION_FINAL_AUDIT.md`.

- Cadastro, login, refresh, logout, senha, e-mail, telefone, dispositivos, sessões, 2FA, step-up e recovery codes usam a API NestJS `/api/v1`.
- Papéis comprador/vendedor/admin agora vêm do banco via `/auth/me.roles`; `VITE_ENABLE_DEMO_ROLES` não concede acesso.
- Não inserir dados reais em domínios de marketplace ainda mockados, como pagamentos, pedidos, seller/admin, KYC e wallet.

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
3. Usar a arquitetura real atual: frontend React/Vite, backend NestJS, PostgreSQL/Prisma, Redis e API REST `/api/v1`.
4. Autenticação real já existe em NestJS/PostgreSQL/Redis para o bloco documentado em `AUTHENTICATION_FINAL_AUDIT.md`; não reabrir plano histórico de auth terceirizada.
5. Implementar autorização/RBAC server-side para marketplace, vendedor e admin.
6. Implementar catálogo real (produtos, categorias, imagens, aprovação).
7. Implementar pedidos, chat, mediação real.
8. Implementar **pagamento e escrow** (`PAYMENT_AND_ESCROW_IMPLEMENTATION_PLAN.md`)
   — parte mais crítica.
9. Implementar wallet real, saques e KYC real.
10. Implementar admin real com auditoria imutável.
11. Implementar e-mails transacionais reais (Resend/SendGrid/SES).
12. Reforçar segurança (`SECURITY_IMPLEMENTATION_PLAN.md`).
13. Avaliar SSR/SSG para SEO das rotas públicas.
14. Configurar monitoramento, backups, LGPD, termos jurídicos.
15. **Deploy** do frontend e backend NestJS em provedores definidos pelo time, sem dependência obrigatória de Supabase.

## Decisões de fornecedores externos

- Nenhum fornecedor externo está definitivamente aprovado neste momento.
- Resend e Twilio são implementações de referência para autenticação, não decisões comerciais definitivas.
- Hospedagem, infraestrutura, PostgreSQL/Redis gerenciados, storage, CDN, DNS, HTTPS, secrets, backups e recuperação de desastre permanecem pendentes.
- Gateway de pagamento, Pix, boleto, cartão, split, escrow, antifraude, saldo, saques e conciliação permanecem pendentes.
- KYC, observabilidade, filas, busca, realtime/chat, analytics, suporte e demais serviços externos permanecem pendentes.
- Consulte `EXTERNAL_SERVICES_DECISION_HANDOFF.md` para o inventário e a matriz neutra de decisão.
- Utilize `EXTERNAL_SERVICE_DECISION_TEMPLATE.md` antes de aprovar qualquer fornecedor para staging ou produção.

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
- Naquela sprint, gerenciamento de 2FA continuava fora de escopo; no estado atual, ativação/desativação, step-up, regeneração de recovery codes e troca EMAIL/SMS estão implementados sem fallback para mock.

## Sprint 2C2B2B2A — status, ativação e desativação segura de 2FA

- `/perfil/seguranca` agora integra o status real de 2FA via `GET /auth/2fa/status` e os fluxos de ativação/desativação com a API NestJS.
- Ativação usa `POST /auth/2fa/enroll/request` para EMAIL ou SMS e `POST /auth/2fa/enroll/confirm` para confirmar código de seis dígitos.
- Recovery codes seguem o contrato real do backend: `XXXXX-XXXXX-XXXXX`, exatamente 10 códigos únicos, exibidos uma única vez e mantidos somente em estado local transitório.
- Desativação usa `POST /auth/2fa/disable/request` e `POST /auth/2fa/disable/confirm`, por código de seis dígitos ou recovery code normalizado, nunca ambos.
- Após desativação confirmada, o frontend limpa access token em memória, cancela/remove queries privadas, limpa autenticação local e navega para `/login`, sem tentar refresh posterior.
- A ativação invalida status de 2FA e lista real de sessões em background; falhas auxiliares não impedem a exibição dos recovery codes.
- Naquele momento, step-up, troca de método e regeneração de recovery codes continuavam pendentes; as sprints posteriores registram o estado atual desses fluxos.

## Sprint 2C2B2B2B1 — step-up recovery regeneration

- Frontend integrates real step-up endpoints for `TWO_FACTOR_RECOVERY_REGENERATE`: `POST /auth/step-up/request`, `POST /auth/step-up/verify`, `POST /auth/step-up/resend`, and `POST /auth/2fa/recovery/regenerate`.
- Recovery-code regeneration confirms by six-digit 2FA code or a normalized 5-5-5 recovery code; the recovery confirmation code is sent only in the verify payload.
- O grant opaco de step-up é validado defensivamente, mantido apenas no escopo local da Promise e enviado imediatamente como `X-Step-Up-Token` para regenerar recovery codes.
- Regeneration expects exactly 10 unique uppercase 5-5-5 codes, treats malformed responses as `MALFORMED_RESPONSE`, warns that old codes may have been invalidated, and reconciles status/sessions without logging out.
- Successful regeneration invalidates old recovery codes and visually refreshes the real sessions list while preserving the current session; new codes are shown once in an exclusive screen.
- Naquele momento, a troca de método 2FA ainda estava pendente para a Sprint 2C2B2B2B2; o estado atual está documentado na seção da Sprint 2C2B2B2B2.

## Sprint 2C2B2B2B2 — troca segura do método 2FA

- Frontend integrado aos endpoints reais `POST /auth/2fa/method/change/request` e `POST /auth/2fa/method/change/confirm`, sempre após step-up com scope `TWO_FACTOR_METHOD_CHANGE`.
- Contratos do backend: request `{ newMethod: "EMAIL" | "SMS" }` com header `X-Step-Up-Token`, resposta `{ challengeId, expiresAt }`; confirm `{ challengeId, code }` com o mesmo header, resposta `{ methodChanged: true }`.
- O grant opaco de step-up é mantido somente em `useRef` local transitório no hook específico, nunca em provider, cache, storage, URL, body, toast ou log, e é apagado em sucesso, cancelamento, desmontagem, erro terminal ou resultado ambíguo.
- O backend consome o grant somente na confirmação bem-sucedida, preserva a sessão atual e revoga outras sessões com motivo `TWO_FACTOR_METHOD_CHANGED`; o frontend reconcilia status 2FA e sessões reais com `throwOnError: true` antes de liberar ações após sucesso ou resultado desconhecido.
- Disponibilidade: não oferece o método atual, só oferece SMS quando o telefone confirmado já está disponível no estado real do usuário, e não exibe endereço completo de e-mail ou telefone.

## Auditoria final de autenticação — 2026-07-17

A documentação consolidada do bloco real de autenticação está em `AUTHENTICATION_FINAL_AUDIT.md`. Ela substitui as afirmações antigas de que não havia backend/autenticação real para o escopo específico de auth. Permanecem mockados fora de autenticação: catálogo, carrinho, checkout, pagamentos, pedidos, vendedor, admin, KYC, wallet, afiliados, notificações de produto e CMS. Próxima sprint recomendada: Staging, homologação e hardening operacional de autenticação antes de iniciar domínios financeiros ou marketplace.

## Marketplace RBAC foundation update

The marketplace authorization foundation is now persistent: `BUYER`, `SELLER` and `ADMIN` live in the backend database, `/auth/me` returns real lowercase roles, and the frontend derives `isAdmin`/`hasSellerAccess` only from that response. Demo role flags no longer grant access. Seller/admin page content remains mock-oriented; only gates and future server-side authorization primitives were added. See `MARKETPLACE_RBAC_FOUNDATION.md`.

## Seller onboarding foundation (2026-07-18)

- Adicionado onboarding real de vendedor sem KYC externo: solicitação persistida, análise administrativa, aprovação/rejeição, criação de perfil inicial e concessão atômica do papel `SELLER`.
- Novos modelos: `SellerApplication` e `SellerProfile`; `SellerProfile.verified` nasce `false` e não representa KYC.
- Produtos, anúncios, vendas, financeiro, reputação, wallet, saques, documentos, selfie e verificação externa continuam mockados ou pendentes para sprints futuras.
- Fornecedor de KYC permanece não escolhido (`NOT_ANALYZED`); nenhum documento real deve ser enviado.
- Consulte `SELLER_ONBOARDING_FOUNDATION.md` para escopo, endpoints, estados e limitações.
