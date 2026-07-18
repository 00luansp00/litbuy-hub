# MOCKS_INVENTORY.md — LIT Buy

Inventário de tudo que é mockado no MVP.
Criticidade: **baixa / média / alta / crítica**.

## 1. Autenticação

### REAL no escopo auditado

- Cadastro.
- Login.
- Verificação de e-mail.
- Recuperação e redefinição de senha.
- Sessões.
- Dispositivos aprovados.
- Alteração segura de telefone/e-mail.
- 2FA, step-up e recovery codes.

### AINDA VISUAL/MOCK fora do contrato real de auth

| Item                      | Criticidade | Necessidade real pendente                    |
| ------------------------- | ----------- | -------------------------------------------- |
| activeRole buyer/seller   | média       | Autorização server-side por domínio          |
| isAdmin/AdminGate         | crítica     | RBAC/guards server-side para admin           |
| Permissões de marketplace | crítica     | Policies/checks backend por recurso          |
| RBAC seller/admin         | crítica     | Modelo de papéis e auditoria no backend real |

## 2. Marketplace

| Item                       | Criticidade | Necessidade real               |
| -------------------------- | ----------- | ------------------------------ |
| Produtos                   | alta        | Tabela `products` + validação  |
| Categorias / subcategorias | média       | CMS admin                      |
| Vendedores                 | alta        | `sellers` + perfil público     |
| Reviews                    | média       | Moderação server-side          |
| Estoque                    | crítica     | Reserva atômica no backend     |
| Status do anúncio          | alta        | Máquina de estados server-side |
| Variações                  | alta        | `product_variants`             |
| Perguntas públicas         | média       | Moderação + notificação        |

## 3. Carrinho / Checkout

| Item         | Criticidade | Necessidade real                    |
| ------------ | ----------- | ----------------------------------- |
| Carrinho     | crítica     | Cart server-side, preço recalculado |
| Cupom        | alta        | Ledger de cupons + antifraude       |
| Proteção LIT | crítica     | Cálculo server-side                 |
| Pix          | crítica     | Gateway (Stripe/PagBank/MP)         |
| Boleto       | crítica     | Gateway                             |
| Cartão demo  | crítica     | Tokenização + PCI                   |
| Saldo LIT    | crítica     | Wallet real (ledger)                |
| LIT Points   | crítica     | Ledger de pontos                    |

## 4. Pedidos

| Item                       | Criticidade | Necessidade real           |
| -------------------------- | ----------- | -------------------------- |
| Pedido                     | crítica     | `orders` + auditoria       |
| Timeline                   | alta        | Máquina de estados         |
| Pagamento                  | crítica     | Webhook gateway            |
| Entrega manual             | alta        | Anexos assinados           |
| Entrega automática (cofre) | crítica     | Storage seguro + auditoria |
| Chat do pedido             | alta        | Realtime + moderação       |
| Mediação                   | crítica     | Workflow admin + SLA       |
| Saldo retido               | crítica     | Escrow real                |

## 5. Vendedor

| Item         | Criticidade | Necessidade real    |
| ------------ | ----------- | ------------------- |
| Anúncios     | alta        | CRUD + aprovação    |
| Vendas       | crítica     | Escrow              |
| Financeiro   | crítica     | Contabilidade       |
| Avaliações   | média       | Moderação           |
| Equipe       | alta        | RBAC vendedor       |
| LIT-MAX      | média       | Cálculo periódico   |
| Cofre Seguro | crítica     | Storage + auditoria |

## 6. Admin

| Item          | Criticidade | Necessidade real |
| ------------- | ----------- | ---------------- |
| Usuários      | crítica     | RBAC + audit     |
| Permissões    | crítica     | RBAC + RLS       |
| Denúncias     | crítica     | Fila + workflow  |
| Disputas      | crítica     | Workflow + SLA   |
| Auditoria     | crítica     | Logs imutáveis   |
| Relatórios    | alta        | BI real          |
| Configurações | alta        | Feature flags    |
| Feature flags | média       | Serviço dedicado |

## 7. Segurança

| Item                | Criticidade | Necessidade real            |
| ------------------- | ----------- | --------------------------- |
| KYC                 | crítica     | Idwall / Unico / Jumio      |
| SMS                 | crítica     | Twilio / Zenvia             |
| Documento           | crítica     | OCR + verificação           |
| Selfie              | crítica     | Liveness                    |
| Novo dispositivo    | alta        | Device fingerprint          |
| E-mail transacional | alta        | Resend / SendGrid / SES     |
| Denúncia            | crítica     | Fila + evidências assinadas |
| Moderação           | alta        | Fila + regras + IA opcional |

## 8. Afiliados

| Item             | Criticidade | Necessidade real        |
| ---------------- | ----------- | ----------------------- |
| Link de afiliado | alta        | Tracking real           |
| Tracking         | crítica     | Atribuição + antifraude |
| Comissão         | crítica     | Ledger financeiro       |
| Saque            | crítica     | KYC + gateway           |
| Campanhas        | média       | CMS admin               |

## 9. Notificações / e-mails

| Item                      | Criticidade | Necessidade real        |
| ------------------------- | ----------- | ----------------------- |
| notificationService       | alta        | Fila + push + realtime  |
| transactionalEmailService | alta        | Provedor real           |
| Templates                 | média       | CMS + versionamento     |
| Histórico                 | média       | Persistência + retenção |
| Preferências              | alta        | `email_preferences`     |

## 10. Páginas públicas

| Item                   | Criticidade | Necessidade real       |
| ---------------------- | ----------- | ---------------------- |
| Conteúdo institucional | média       | CMS                    |
| Termos                 | crítica     | Revisão jurídica       |
| Privacidade / LGPD     | crítica     | Revisão jurídica + DPO |
| Regras                 | alta        | CMS + versão           |
| Contato                | média       | Backend + anti-spam    |

## Convenção final

- Tudo listado acima é **visual/mockado**.
- Nenhum dado real deve ser inserido enquanto backend não existir.
- Todo item marcado **crítica** exige desenvolvedor sênior + revisão
  de segurança antes de produção.

## Sprint 2C2B1 — autenticação removida dos mocks centrais

`AuthProvider`, `/login`, `/cadastro`, `/verificar-email`, `/verificacao-login`, `/recuperar-senha`, `/redefinir-senha` e `/perfil/seguranca` foram integrados à API NestJS real. `src/services/authMock.ts` foi excluído e não existe fallback mockado de autenticação. Mocks de catálogo, carrinho, vendedor, admin visual e outros domínios seguem fora do escopo desta sprint.

## Sprint 2C2B2A

Sessões, dispositivos aprovados e alteração autenticada de senha usam somente endpoints reais NestJS. Outros domínios do marketplace permanecem mockados conforme inventário acima.

## Sprint 2C2B2B1

- Telefone seguro e alteração de e-mail não usam fallback mockado no frontend.
- Services reais adicionados em `src/services/auth/phoneEmailSecurity.ts` para os endpoints `/auth/phone/request`, `/auth/phone/verify`, `/auth/email/change/request` e `/auth/email/change/confirm`.

## Sprint 2C2B2B2A

- O gerenciamento de 2FA da Central de Segurança não usa mock ou fallback local.
- Endpoints reais integrados: `/auth/2fa/status`, `/auth/2fa/enroll/request`, `/auth/2fa/enroll/confirm`, `/auth/2fa/disable/request` e `/auth/2fa/disable/confirm`.
- Recovery codes reais têm formato `XXXXX-XXXXX-XXXXX`, são exibidos uma única vez e nunca são salvos em QueryCache, MutationCache, storage, URL, provider, logs ou toast.
- Naquela sprint, step-up, troca de método e regeneração de recovery codes ainda não estavam implementados no frontend; no estado atual, step-up, regeneração e troca EMAIL/SMS estão implementados sem mock ou fallback local.

## Sprint 2C2B2B2B1 — step-up recovery regeneration

- Frontend integrates real step-up endpoints for `TWO_FACTOR_RECOVERY_REGENERATE`: `POST /auth/step-up/request`, `POST /auth/step-up/verify`, `POST /auth/step-up/resend`, and `POST /auth/2fa/recovery/regenerate`.
- Recovery-code regeneration confirms by six-digit 2FA code or a normalized 5-5-5 recovery code; the recovery confirmation code is sent only in the verify payload.
- O grant opaco de step-up é validado defensivamente, mantido apenas no escopo local da Promise e enviado imediatamente como `X-Step-Up-Token` para regenerar recovery codes.
- Regeneration expects exactly 10 unique uppercase 5-5-5 codes, treats malformed responses as `MALFORMED_RESPONSE`, warns that old codes may have been invalidated, and reconciles status/sessions without logging out.
- Successful regeneration invalidates old recovery codes and visually refreshes the real sessions list while preserving the current session; new codes are shown once in an exclusive screen.
- Naquele momento, a troca de método 2FA ainda estava pendente para a Sprint 2C2B2B2B2; o estado atual está documentado na seção da Sprint 2C2B2B2B2.

## Sprint 2C2B2B2B2 — sem mock para troca de método 2FA

Não há mock ou fallback silencioso para `POST /auth/2fa/method/change/request` ou `POST /auth/2fa/method/change/confirm`. A UI depende dos contratos reais do backend e da disponibilidade real de EMAIL/SMS já carregada no frontend.

## Atualização — autenticação removida do inventário de mocks (2026-07-17)

Autenticação não deve mais ser tratada como mock: os fluxos reais estão listados em `AUTHENTICATION_FINAL_AUDIT.md`. Continuam mockados fora de autenticação: catálogo, produtos, categorias, carrinho, checkout, pagamentos, pedidos, vendedor, admin, KYC, wallet, afiliados, notificações de produto, mensagens e CMS.

## Marketplace RBAC foundation update

The marketplace authorization foundation is now persistent: `BUYER`, `SELLER` and `ADMIN` live in the backend database, `/auth/me` returns real lowercase roles, and the frontend derives `isAdmin`/`hasSellerAccess` only from that response. Demo role flags no longer grant access. Seller/admin page content remains mock-oriented; only gates and future server-side authorization primitives were added. See `MARKETPLACE_RBAC_FOUNDATION.md`.
