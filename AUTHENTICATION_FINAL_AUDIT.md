# AUTHENTICATION_FINAL_AUDIT.md — auditoria final de autenticação LIT Buy

Data da auditoria: 2026-07-17. Branch: `codex/authentication-final-audit-handoff`. Base local auditada: `b38c95ad32b31b835f2a798c12b7b283bee3de11`, contendo os merges dos PRs #13, #14 e #15 no histórico local.

## 1. Resumo executivo

A autenticação real do LIT Buy está integrada entre frontend React/TanStack e backend NestJS para o bloco de cadastro, login, verificação de e-mail, aprovação de dispositivo, 2FA, recovery codes, step-up, sessões, dispositivos, alteração de senha, alteração segura de telefone e alteração segura de e-mail. A auditoria não encontrou necessidade comprovada de alterar contratos backend nem de tocar em pagamentos, produtos, pedidos, vendedor, admin, KYC, wallet ou permissões de marketplace.

O frontend usa `src/lib/api/client.ts` como cliente único da API, mantém access token apenas em memória e envia cookies controlados pelo backend com `credentials: "include"`. O backend concentra controles de cookies, CSRF, refresh token rotation, revogação de sessão, guards, rate limits Redis, eventos de segurança e persistência PostgreSQL/Prisma no módulo de autenticação.

Resultado: **AUDITORIA FINAL DE AUTENTICAÇÃO INCOMPLETA — AGUARDANDO CI E REVISÃO.** A documentação foi consolidada para handoff e a homologação final depende da execução completa do CI obrigatório em ambiente com serviços externos necessários.

## 2. Fluxos reais concluídos

- Cadastro com aceite de termos/privacidade, idade mínima e criação de dispositivo inicial.
- Verificação de e-mail com token opaco.
- Login com senha, decisão de e-mail pendente, dispositivo pendente ou sucesso autenticado.
- Aprovação e reenvio de aprovação de dispositivo.
- Login com 2FA por EMAIL/SMS, reenvio de challenge e uso alternativo de recovery code.
- Recuperação e redefinição de senha com resposta pública genérica e revogação de sessões após reset.
- Refresh de sessão via cookie de refresh + CSRF e access token novo somente em memória.
- Logout atual e logout global com limpeza/revogação de sessão.
- Listagem e revogação de sessões.
- Listagem e revogação de dispositivos aprovados.
- Alteração autenticada de senha com senha atual e revogação de sessões.
- Alteração segura de telefone com challenge SMS e reconciliação de estado.
- Alteração segura de e-mail com confirmação dupla e hold/revogação.
- Status de 2FA.
- Ativação de 2FA com challenge e entrega de recovery codes somente uma vez.
- Desativação de 2FA.
- Regeneração de recovery codes com step-up e reconciliação de resultado ambíguo.
- Step-up por EMAIL/SMS/recovery code para operações sensíveis.
- Troca segura do método EMAIL/SMS com step-up, challenge e reconciliação.

## 3. Endpoints usados

Todos os endpoints frontend usam base `VITE_API_BASE_URL`, esperada como `/api/v1` no backend.

| Método | Endpoint                        | Uso                                  |
| ------ | ------------------------------- | ------------------------------------ |
| POST   | `/auth/register`                | Cadastro                             |
| POST   | `/auth/email/verify`            | Verificação de e-mail                |
| POST   | `/auth/email/resend`            | Reenvio de verificação               |
| POST   | `/auth/login`                   | Login                                |
| POST   | `/auth/device/approve`          | Aprovação de dispositivo             |
| POST   | `/auth/device/resend`           | Reenvio de aprovação                 |
| POST   | `/auth/2fa/login/verify`        | Verificação 2FA no login             |
| POST   | `/auth/2fa/login/resend`        | Reenvio 2FA no login                 |
| POST   | `/auth/password/forgot`         | Solicitação de reset                 |
| POST   | `/auth/password/reset`          | Redefinição de senha                 |
| POST   | `/auth/refresh`                 | Refresh de access token              |
| POST   | `/auth/logout`                  | Logout da sessão atual               |
| GET    | `/auth/me`                      | Usuário autenticado                  |
| GET    | `/auth/sessions`                | Sessões reais                        |
| DELETE | `/auth/sessions/:sessionId`     | Revogar sessão                       |
| POST   | `/auth/sessions/logout-all`     | Logout global                        |
| GET    | `/auth/devices`                 | Dispositivos reais                   |
| DELETE | `/auth/devices/:deviceId`       | Revogar dispositivo                  |
| POST   | `/auth/password/change`         | Alteração de senha                   |
| POST   | `/auth/email/change/request`    | Iniciar alteração segura de e-mail   |
| POST   | `/auth/email/change/confirm`    | Confirmar alteração segura de e-mail |
| POST   | `/auth/phone/request`           | Iniciar alteração segura de telefone |
| POST   | `/auth/phone/verify`            | Confirmar telefone                   |
| GET    | `/auth/2fa/status`              | Status de 2FA                        |
| POST   | `/auth/2fa/enroll/request`      | Iniciar ativação 2FA                 |
| POST   | `/auth/2fa/enroll/confirm`      | Confirmar ativação 2FA               |
| POST   | `/auth/2fa/disable/request`     | Iniciar desativação 2FA              |
| POST   | `/auth/2fa/disable/confirm`     | Confirmar desativação 2FA            |
| POST   | `/auth/step-up/request`         | Solicitar step-up                    |
| POST   | `/auth/step-up/verify`          | Verificar step-up                    |
| POST   | `/auth/step-up/resend`          | Reenviar step-up                     |
| POST   | `/auth/2fa/recovery/regenerate` | Regenerar recovery codes             |
| POST   | `/auth/2fa/method/request`      | Solicitar troca de método            |
| POST   | `/auth/2fa/method/confirm`      | Confirmar troca de método            |

## 4. Cookies e tokens

- Access token: retornado pelo backend e guardado somente em variável de módulo do frontend (`accessToken`), nunca em `localStorage`/`sessionStorage`.
- Refresh token: cookie backend, `HttpOnly`, usado apenas em `/auth/refresh` e controlado pelo servidor.
- Device cookie: cookie backend para identificação/associação de dispositivo aprovado ou pendente.
- CSRF: cookie legível `litbuy_csrf`; frontend só lê para enviar `X-CSRF-Token` em métodos POST/PUT/PATCH/DELETE.
- Challenge tokens de e-mail/dispositivo/senha: circulam em links e payloads pontuais; não são persistidos pelo frontend após submissão.
- Step-up token: usado em memória por hook específico para confirmar operação sensível; não é salvo em cache global.
- Recovery codes: exibidos uma única vez após ativação/regeneração e não entram no QueryCache como estado durável.

## 5. Regras de sessão

- Access token expirado dispara refresh single-flight no cliente para evitar múltiplas rotações simultâneas.
- 401 em endpoints sensíveis não elegíveis a refresh não faz retry silencioso.
- Falha de refresh limpa access token em memória e aciona perda de autenticação.
- Logout local limpa estado mesmo se a API estiver indisponível, mas o backend permanece responsável por revogação real quando alcançável.
- Revogação de sessão/dispositivo invalida dados relacionados e limpa cookies quando a sessão atual é afetada.
- Backend verifica sessão ativa, device aprovado, expiração e revogação no guard de access token.

## 6. Regras de 2FA

- Métodos reais suportados no contrato: `EMAIL` e `SMS`.
- Challenges têm `challengeId`, TTL e tentativa limitada no backend.
- Login 2FA aceita código de 6 dígitos ou recovery code normalizado, nunca ambos.
- Recovery codes seguem formato `AAAAA-BBBBB-CCCCC`, são únicos no lote e retornam apenas em ativação/regeneração.
- Ativação, desativação, regeneração e troca de método reconciliam status real depois de respostas ambíguas.
- Troca de método exige step-up e confirma disponibilidade do canal alvo.

## 7. Segredos e onde não são persistidos

A auditoria confirmou por inspeção estática que o bloco de autenticação não grava access token, refresh token, CSRF, challenge secret, recovery code, senha ou step-up token em:

- `localStorage`;
- `sessionStorage`;
- URL persistida pelo app após consumo de rotas públicas;
- QueryCache/MutationCache como segredo durável;
- AuthProvider/context global além de estado transitório de challenge sem código;
- `globalThis` ou `window`;
- logs e `console`;
- toast;
- analytics;
- snapshots versionados.

## 8. Testes existentes

Frontend: testes Vitest cobrem cliente API, AuthProvider, AuthGate, rotas públicas de auth, serviços de segurança, sessões/dispositivos/senha, alteração segura de telefone/e-mail, 2FA, step-up, recovery code regeneration e troca de método 2FA.

Backend: testes Jest cobrem utilitários, ambiente, controller/service via unit/e2e, readiness, fluxos HTTP de auth, cookies/CSRF, rotação de refresh, revogação, sessões/dispositivos, senha, telefone/e-mail, 2FA, step-up, recovery codes e integração com PostgreSQL/Redis quando disponível.

## 9. Riscos conhecidos

- Provedores reais de e-mail/SMS ainda precisam ser configurados e auditados; adaptadores de memória são apenas desenvolvimento/teste.
- A revisão jurídica de termos, privacidade, idade mínima, retenção e LGPD continua pendente.
- O frontend ainda mantém papéis visuais para buyer/seller/admin quando `VITE_ENABLE_DEMO_ROLES=true`; isso não concede permissão backend real.
- CI e integração dependem de serviços externos e variáveis de ambiente corretas.
- Segurança profissional externa ainda é necessária antes de produção.

## 10. Limitações

- Esta auditoria não implementou novas funcionalidades.
- Pagamentos, produtos, pedidos, vendedor, admin, KYC, wallet e permissões de marketplace ficaram fora de escopo.
- Não houve alteração de contratos backend sem bug comprovado.
- A conclusão final depende dos checks obrigatórios e do CI remoto.

## 11. Pontos que exigem revisão profissional

- Hardening de cookies (`Secure`, `SameSite`, domínio e path) no ambiente de produção real.
- Rate limits e lockouts por IP/usuário/dispositivo em tráfego real.
- Provider de SMS/e-mail, entrega, retry, anti-enumeração e proteção contra abuso.
- Threat modeling de recovery codes e step-up grants.
- Observabilidade segura sem vazamento de PII/segredos.
- LGPD, retenção, consentimento, portabilidade e exclusão de dados.
- Pentest externo antes de liberar cadastro real ao público.

## 12. Lista exata do que permanece mockado fora da autenticação

- Catálogo, categorias, produtos, variações e estoque.
- Carrinho, cupons e checkout.
- Pagamentos Pix/boleto/cartão, Proteção LIT, split e escrow.
- Pedidos, timeline, entrega, disputas e mediação.
- Seller dashboard, anúncios, vendas, financeiro, avaliações e equipe.
- Admin visual, permissões de marketplace, auditoria admin e moderação.
- KYC visual, documento, selfie, verificação de identidade e AML.
- Wallet, saldo, LIT Points, ledger, saques e comissões.
- Mensagens, notificações, e-mails transacionais de produto e preferências.
- Afiliados, tracking e comissões.
- CMS institucional, SEO dinâmico e analytics/consentimento.

## 13. Checklist para homologação

- [ ] Executar todos os comandos obrigatórios frontend e backend.
- [ ] Confirmar CI: Frontend validation, Backend validation e Backend integration.
- [ ] Validar login completo com e-mail verificado e device aprovado em ambiente staging.
- [ ] Validar login 2FA EMAIL e SMS com expiração e rate limit.
- [ ] Validar recovery code único e consumo/redução de saldo.
- [ ] Validar refresh token rotation e detecção de reuse.
- [ ] Validar logout atual, logout global e revogação de dispositivo.
- [ ] Validar alteração de senha revogando sessões antigas.
- [ ] Validar alteração segura de e-mail com dupla confirmação.
- [ ] Validar alteração segura de telefone com SMS real.
- [ ] Verificar cookies em browser real com flags de produção.
- [ ] Verificar ausência de segredos em storage, cache, URL, logs e toasts.

## 14. Checklist para entrega ao desenvolvedor

- [ ] Ler este arquivo antes de alterar auth.
- [ ] Conferir `API_CONTRACTS_DRAFT.md` para contratos reais de auth.
- [ ] Conferir `PROVIDERS_MAP.md` para responsabilidades de AuthProvider.
- [ ] Conferir `ROUTES_MAP.md` para rotas públicas e privadas de auth.
- [ ] Conferir `MOCKS_INVENTORY.md` antes de tocar domínios fora de auth.
- [ ] Não misturar autenticação com pagamentos/wallet/admin/KYC.
- [ ] Manter access token fora de storage persistente.
- [ ] Nunca logar senhas, recovery codes, refresh tokens, hashes ou peppers.
- [ ] Criar testes para qualquer mudança crítica.

## 15. Recomendação da próxima sprint

Próxima sprint recomendada: **CI/staging e hardening operacional de autenticação**. Subir ambiente staging com PostgreSQL/Redis reais, provedores transacionais controlados, cookies de produção, observabilidade segura e execução completa dos checks obrigatórios. Não iniciar pagamentos, seller/admin ou wallet antes de fechar homologação de autenticação.

## Matriz consolidada

| Fluxo                            | Frontend real | Backend real | Testes | Mock                              | Risco | Status                         |
| -------------------------------- | ------------- | ------------ | ------ | --------------------------------- | ----- | ------------------------------ |
| Cadastro                         | Sim           | Sim          | Sim    | Não                               | Médio | Concluído para handoff         |
| Login                            | Sim           | Sim          | Sim    | Não                               | Médio | Concluído para handoff         |
| Verificação de e-mail            | Sim           | Sim          | Sim    | Não                               | Médio | Concluído para handoff         |
| Aprovação de dispositivo         | Sim           | Sim          | Sim    | Não                               | Médio | Concluído para handoff         |
| Login 2FA                        | Sim           | Sim          | Sim    | Não                               | Alto  | Concluído para handoff         |
| Recuperação/redefinição de senha | Sim           | Sim          | Sim    | Não                               | Alto  | Concluído para handoff         |
| Refresh de sessão                | Sim           | Sim          | Sim    | Não                               | Alto  | Concluído para handoff         |
| Logout                           | Sim           | Sim          | Sim    | Não                               | Médio | Concluído para handoff         |
| Sessões                          | Sim           | Sim          | Sim    | Não                               | Alto  | Concluído para handoff         |
| Dispositivos aprovados           | Sim           | Sim          | Sim    | Não                               | Alto  | Concluído para handoff         |
| Alteração de senha               | Sim           | Sim          | Sim    | Não                               | Alto  | Concluído para handoff         |
| Alteração segura de telefone     | Sim           | Sim          | Sim    | SMS provider não produtivo        | Alto  | Concluído para handoff técnico |
| Alteração segura de e-mail       | Sim           | Sim          | Sim    | E-mail provider não produtivo     | Alto  | Concluído para handoff técnico |
| Status de 2FA                    | Sim           | Sim          | Sim    | Não                               | Médio | Concluído para handoff         |
| Ativação de 2FA                  | Sim           | Sim          | Sim    | Entrega provider não produtiva    | Alto  | Concluído para handoff técnico |
| Desativação de 2FA               | Sim           | Sim          | Sim    | Não                               | Alto  | Concluído para handoff         |
| Recovery codes                   | Sim           | Sim          | Sim    | Não                               | Alto  | Concluído para handoff         |
| Step-up                          | Sim           | Sim          | Sim    | Entrega provider não produtiva    | Alto  | Concluído para handoff técnico |
| Regeneração recovery codes       | Sim           | Sim          | Sim    | Não                               | Alto  | Concluído para handoff         |
| Troca EMAIL/SMS                  | Sim           | Sim          | Sim    | SMS/e-mail provider não produtivo | Alto  | Concluído para handoff técnico |
