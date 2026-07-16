# PROVIDERS_MAP.md — LIT Buy

Providers globais em `src/providers/` embrulham a aplicação em
`src/routes/__root.tsx`. Todos são **mockados** e mantêm estado
apenas em memória.

## AuthProvider (`src/providers/AuthProvider.tsx`)

- **Responsabilidade**: expor usuário logado, `activeRole`
  (buyer/seller/admin visual), login/logout demo.
- **Estado**: usuário atual em memória (`useState`).
- **Mock**: qualquer e-mail loga; `admin@litbuy.com` recebe papel admin.
- **Limitações**: sem token, sem refresh, sem RBAC real, sem sessão
  persistida. Recarregar a página desloga.
- **Substituição futura**: Supabase Auth (ou equivalente) com
  verificação de e-mail, 2FA, roles server-side, tokens JWT httpOnly.
- **Riscos**: `AuthGate`/`AdminGate` são apenas visuais. Qualquer
  proteção real precisa RLS/checks no backend.

## CartProvider (`src/providers/CartProvider.tsx`)

- **Responsabilidade**: itens do carrinho, quantidade, cupom, Proteção
  LIT, LIT Points selecionados.
- **Estado**: array em memória.
- **Limitações**: sem persistência, sem multi-device, sem reserva de
  estoque. Preço, taxas e disponibilidade calculados no client.
- **Substituição futura**: cart server-side (endpoint idempotente),
  preço final SEMPRE recalculado no backend, estoque reservado.
- **Riscos**: nunca confiar em totais vindos do frontend em produção.

## NotificationProvider (`src/providers/NotificationProvider.tsx`)

- **Responsabilidade**: expor lista de notificações mockadas, contador
  de não lidas, marcar como lida.
- **Estado**: array em memória.
- **Limitações**: sem push, sem realtime, sem persistência.
- **Substituição futura**: backend com fila, WebSocket/SSE, Web Push,
  e-mails transacionais reais, preferências por canal.
- **Riscos**: notificações críticas (segurança, pagamento) precisam
  garantia de entrega — não podem viver só na UI.

## Outros contextos

- **QueryClientProvider** (TanStack Query): configurado em
  `src/router.tsx`. Cache client-side. Manter no backend real
  (compatível).
- **Toaster / Sonner**: apenas UI, sem dados.

## Observação sobre ErrorBoundary

Não é provider, mas envolve a árvore em `__root.tsx`
(`src/components/error/ErrorBoundary.tsx`). Captura erros de
renderização e mostra fallback dark premium.

## Regra geral

Todos os providers mockados devem ser **substituídos ou complementados**
por chamadas reais ao backend. O frontend nunca deve ser fonte de
verdade para dinheiro, permissão, KYC ou notificação de segurança.

## Sprint 2C2B1 — AuthProvider real

`src/providers/AuthProvider.tsx` não depende mais de `authMock`. Ele inicializa de forma segura no cliente, tenta `/auth/refresh`, carrega `/auth/me`, mantém access token em memória via `src/lib/api/client.ts` e expõe estados `initializing`, `anonymous`, `authenticated`, `emailVerificationRequired`, `deviceApprovalRequired` e `twoFactorRequired`. Papéis comprador/vendedor seguem apenas como contexto visual; `VITE_ENABLE_DEMO_ROLES=false` por padrão e não concede autorização real.

## Sprint 2C2B2A

`AuthProvider` segue sem armazenar listas de sessões/dispositivos. A única expansão foi uma ação explícita de limpeza local para fluxos em que a API revoga a sessão atual. Dados privados da Central de Segurança ficam em TanStack Query e são removidos no logout/perda de autenticação.

## Sprint 2C2B2B1

- Nenhum estado sensível de formulário foi adicionado ao `AuthProvider`.
- Os hooks específicos de telefone/e-mail reutilizam `clearAuthentication`, removem access token em memória e limpam queries privadas quando o backend revoga sessões.

## Sprint 2C2B2B2A

- `AuthProvider` não armazena status de 2FA, challengeId, senha, código ou recovery codes.
- Status de 2FA fica exclusivamente em TanStack Query com chave `['auth','2fa','status']`.
- Recovery codes, challengeId, senha e códigos digitados permanecem somente no estado local transitório de `TwoFactorSecuritySection`.
- Desativação confirmada limpa access token em memória, remove queries privadas e usa `clearAuthentication`; não há persistência de segredo em provider, storage ou URL.

## Sprint 2C2B2B2B1 — step-up recovery regeneration
- Frontend integrates real step-up endpoints for `TWO_FACTOR_RECOVERY_REGENERATE`: `POST /auth/step-up/request`, `POST /auth/step-up/verify`, `POST /auth/step-up/resend`, and `POST /auth/2fa/recovery/regenerate`.
- Recovery-code regeneration confirms by six-digit 2FA code or a normalized 5-5-5 recovery code; the recovery confirmation code is sent only in the verify payload.
- The opaque `stepUpToken` is validated defensively, kept only in the local Promise scope, and immediately sent as `X-Step-Up-Token` to regenerate recovery codes.
- Regeneration expects exactly 10 unique uppercase 5-5-5 codes, treats malformed responses as `MALFORMED_RESPONSE`, warns that old codes may have been invalidated, and reconciles status/sessions without logging out.
- Successful regeneration invalidates old recovery codes and visually refreshes the real sessions list while preserving the current session; new codes are shown once in an exclusive screen.
- 2FA method change remains pending for Sprint 2C2B2B2B2; no method-change UI was added.
