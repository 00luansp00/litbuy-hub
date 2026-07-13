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
