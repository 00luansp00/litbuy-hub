# LIT Buy — runbook de homologação de autenticação em staging

## 1. Objetivo e limites

Preparar e validar autenticação em staging com PostgreSQL e Redis reais, sem produção pública, usuários reais, credenciais reais no Git, pagamentos ou domínios de marketplace.

## 2. Topologia recomendada

Frontend chama somente a API `/api/v1`; backend NestJS usa PostgreSQL como fonte de verdade e Redis para rate limit/cache temporário. O proxy HTTPS termina TLS e encaminha `X-Forwarded-*`; `TRUST_PROXY` deve ser `false` em desenvolvimento direto, um número positivo de hops, nomes conhecidos do Express/proxy-addr (`loopback`, `linklocal`, `uniquelocal`) ou lista explícita de IPs/CIDRs confiáveis. `true` genérico, zero, negativos e texto arbitrário são proibidos em staging/production para reduzir spoofing de `X-Forwarded-*`.

## 3. Matriz de ambientes

| Ambiente    | Uso              | Providers                             | Cookies                        |
| ----------- | ---------------- | ------------------------------------- | ------------------------------ |
| development | dev local        | memory/disabled permitidos            | `Secure=false`, origens locais |
| test        | CI/e2e isolado   | memory controlado                     | sem produção                   |
| staging     | homologação real | external real obrigatório; sem memory | `Secure=true`, CORS explícito  |
| production  | público futuro   | external obrigatório                  | `Secure=true`, sem Swagger     |

## 4. Variáveis obrigatórias

Ver `backend/.env.example`, `backend/.env.staging.example`, `backend/.env.staging.local.example`, `.env.example` e `frontend/.env.staging.example`. Secrets/peppers de autenticação em staging/production devem ter pelo menos 32 caracteres e ser gerados fora do repositório; placeholders são rejeitados. `PUBLIC_FRONTEND_ORIGIN`, `PUBLIC_API_ORIGIN` e `AUTH_COOKIE_TOPOLOGY` documentam a topologia pública usada para validar cookies/CSRF.

## 5. Migrations

Executar `bun install --frozen-lockfile`, `bun run prisma:generate` e `bun run prisma:migrate:deploy`. Nunca usar `prisma db push` em staging/production.

## 6. Inicialização

Backend: `cd backend && bun run build && bun run start:prod`. Frontend: configurar `VITE_API_BASE_URL`, executar build e servir o artefato. Para simulação local, use `docker compose -f docker-compose.staging.yml up --build` após revisar o `.env.staging.local.example`; o serviço one-shot `migrate` executa `prisma migrate deploy` apenas nessa simulação local/rehearsal. O compose publica portas somente em `127.0.0.1` e não deve ser exposto em rede pública; a senha fixa do rehearsal não é segura para staging real.

## 7. Health/readiness

Liveness: `GET /api/v1/health/live`. Readiness: `GET /api/v1/health/ready`, que deve falhar se PostgreSQL ou Redis estiver indisponível.

## 8. Cookies e CORS

Validar `litbuy_refresh` e `litbuy_device` como `HttpOnly`; `litbuy_csrf` legível pelo frontend; `Secure=true` em staging/production; `CORS_ORIGINS` sem wildcard e com `credentials=true`. Topologias suportadas: (A) `same-origin` com esquema, hostname e porta idênticos e cookie host-only; (B) `same-host` com mesmo hostname, portas possivelmente diferentes, cookie host-only e CORS obrigatório quando as origens diferirem; (C) frontend/API em subdomínios do mesmo domínio registrável com `AUTH_COOKIE_TOPOLOGY=same-site-subdomains` e `AUTH_COOKIE_DOMAIN` definido para o domínio pai compartilhado (ex.: `example.test`, nunca hardcoded para o domínio real); (D) `cross-site` real fica bloqueado até existir transporte CSRF que não dependa de cookie compartilhável. Subdomínios podem ser cross-origin, mas normalmente continuam same-site quando compartilham o domínio registrável; use `SameSite=None` somente com HTTPS e após revisão de segurança.

## 9. E-mail/SMS futuros

Não há fornecedor definitivo nesta sprint. Staging real fica bloqueado até instalar adapters externos concretos de e-mail e SMS; uma variável booleana não é prova de provider instalado. Memory só é permitido com `NODE_ENV=test` em CI/e2e/local rehearsal isolado, e nenhuma entrega pode ser simulada como sucesso em staging/production.

## 10. Checklist de browser

Confirmar ausência de access token em localStorage, sessionStorage, URL, QueryCache, MutationCache, context global, `window`, console, toast e snapshots.

## 11. Checklist completo de fluxos de auth

Executar cadastro, verificação de e-mail, aprovação de dispositivo, login, refresh, logout, sessão revogada, recuperação/redefinição de senha, alteração de senha, alteração de e-mail, telefone, status/ativação/desativação/troca de 2FA, step-up e regeneração de recovery codes. O checklist preserva o escopo auditado em `AUTHENTICATION_FINAL_AUDIT.md` e adiciona validação operacional de staging.

## 12. Logs

Verificar JSON/linhas estruturadas com request ID, método, rota normalizada, status, duração e ambiente. Confirmar redaction de Authorization, cookies, CSRF, senhas, 2FA, recovery codes, tokens, grants, telefone e e-mail.

## 13. Storage/cache/URL

Redis não é fonte definitiva de usuários. Tokens e códigos não devem aparecer em URL persistente, logs, artifacts ou cache frontend.

## 14. Rollback

Rollback de aplicação deve apontar para imagem/commit anterior compatível. Não fazer merge em produção nesta sprint.

## 15. Backup e restore

Antes de homologação com dados reais de teste, executar `pg_dump`; validar restore em banco separado. Migrations destrutivas exigem plano específico e backup testado.

## 16. Incidentes

Revogar sessões no banco, rotacionar peppers/secrets se expostos, invalidar cookies via logout-all e registrar evento. Redis pode ser limpo para remover grants/rate limits, sem tratar como backup.

## 17. Critérios para staging aprovado

CI verde, smoke de infraestrutura verde, readiness real, providers externos concretos instalados e testados, cookies/CORS auditados, logs redigidos e checklist manual executado.

## 18. Critérios que impedem produção

Swagger aberto, wildcard CORS, cookies inseguros, providers memory, secrets placeholders, sem backup/restore testado, sem revisão jurídica/LGPD/pentest/profissional.

## 19. Revisão profissional

Antes de produção: dev sênior, segurança/pentest, jurídico LGPD/termos, observabilidade centralizada, plano de incidentes e revisão de infraestrutura.

## External authentication delivery providers (Resend + Twilio)

1. Resend: create an API key with the minimum permission required to send transactional authentication e-mail. Verify the sending domain in Resend before enabling staging. Configure a verified `RESEND_FROM_EMAIL`, a clear `RESEND_FROM_NAME` such as `LIT Buy`, and optional `RESEND_REPLY_TO` only if monitored.
2. Twilio: configure Programmable Messaging, not Twilio Verify. Use either a Messaging Service SID or a single approved From Number in E.164 format; do not configure both at the same time.
3. Store `RESEND_API_KEY`, `TWILIO_ACCOUNT_SID`, and `TWILIO_AUTH_TOKEN` only in the deployment secret manager. Never place real credentials in Git, Docker build args, screenshots, tickets, or logs.
4. Staging must use `AUTH_EMAIL_DELIVERY_MODE=external`, `AUTH_EMAIL_PROVIDER=resend`, `AUTH_SMS_DELIVERY_MODE=external`, and `AUTH_SMS_PROVIDER=twilio`. Boot should fail if any required value is missing or still a placeholder.
5. Controlled staging test: use dedicated test accounts, request e-mail verification, password reset, device approval, e-mail change, phone verification, 2FA, step-up, method change, and recovery-code regeneration notices. Confirm provider acceptance before considering the API response successful.
6. Approval criteria: messages arrive at the intended test inbox/phone, links resolve to the existing frontend auth routes, SMS codes are generated by LIT Buy, no provider error leaks to clients, and logs contain no e-mail, phone, token, code, credentials, or template bodies.
7. Rollback: switch a provider mode to `disabled` only as an emergency containment measure. This preserves fail-closed behavior: flows that require delivery return the existing delivery-unavailable errors instead of pretending success.
8. Production still requires professional deliverability/security review, domain alignment checks, sender reputation review, and a real delivery test plan before launch.
