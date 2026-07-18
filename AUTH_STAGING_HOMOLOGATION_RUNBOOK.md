# LIT Buy — runbook de homologação de autenticação em staging

## 1. Objetivo e limites

Preparar e validar autenticação em staging com PostgreSQL e Redis reais, sem produção pública, usuários reais, credenciais reais no Git, pagamentos ou domínios de marketplace.

## 2. Topologia recomendada

Frontend chama somente a API `/api/v1`; backend NestJS usa PostgreSQL como fonte de verdade e Redis para rate limit/cache temporário. O proxy HTTPS termina TLS e encaminha `X-Forwarded-*`; `TRUST_PROXY` deve usar número de hops ou lista de proxies confiáveis; `true` genérico é proibido em staging/production para reduzir spoofing de `X-Forwarded-*`.

## 3. Matriz de ambientes

| Ambiente    | Uso              | Providers                             | Cookies                        |
| ----------- | ---------------- | ------------------------------------- | ------------------------------ |
| development | dev local        | memory/disabled permitidos            | `Secure=false`, origens locais |
| test        | CI/e2e isolado   | memory controlado                     | sem produção                   |
| staging     | homologação real | external real obrigatório; sem memory | `Secure=true`, CORS explícito  |
| production  | público futuro   | external obrigatório                  | `Secure=true`, sem Swagger     |

## 4. Variáveis obrigatórias

Ver `backend/.env.example`, `backend/.env.staging.example`, `backend/.env.staging.local.example`, `.env.example` e `frontend/.env.staging.example`. Secrets devem ser gerados fora do repositório; placeholders são rejeitados em staging/production.

## 5. Migrations

Executar `bun install --frozen-lockfile`, `bun run prisma:generate` e `bun run prisma:migrate:deploy`. Nunca usar `prisma db push` em staging/production.

## 6. Inicialização

Backend: `cd backend && bun run build && bun run start:prod`. Frontend: configurar `VITE_API_BASE_URL`, executar build e servir o artefato. Para simulação local, use `docker compose -f docker-compose.staging.yml up --build` após revisar o `.env.staging.local.example`; o serviço one-shot `migrate` executa `prisma migrate deploy` apenas nessa simulação local/rehearsal.

## 7. Health/readiness

Liveness: `GET /api/v1/health/live`. Readiness: `GET /api/v1/health/ready`, que deve falhar se PostgreSQL ou Redis estiver indisponível.

## 8. Cookies e CORS

Validar `litbuy_refresh` e `litbuy_device` como `HttpOnly`; `litbuy_csrf` legível pelo frontend; `Secure=true` em staging/production; `SameSite=lax` para mesmo site; subdomínios podem ser cross-origin mas normalmente continuam same-site quando compartilham o domínio registrável. Use `SameSite=None` somente quando houver cross-site real e sempre com HTTPS; `CORS_ORIGINS` sem wildcard e com `credentials=true`.

## 9. E-mail/SMS futuros

Não há fornecedor definitivo nesta sprint. Staging real deve configurar providers externos por integração futura. Memory só é permitido com `NODE_ENV=test` em CI/e2e/local rehearsal isolado.

## 10. Checklist de browser

Confirmar ausência de access token em localStorage, sessionStorage, URL, QueryCache, MutationCache, context global, `window`, console, toast e snapshots.

## 11. Checklist completo de fluxos de auth

Executar cadastro, verificação de e-mail, aprovação de dispositivo, login, refresh, logout, sessão revogada, recuperação/redefinição de senha, alteração de senha, alteração de e-mail, telefone, status/ativação/desativação/troca de 2FA, step-up e regeneração de recovery codes. O checklist preserva o escopo auditado em `AUTHENTICATION_FINAL_AUDIT.md` e adiciona validação operacional de staging.

## 12. Logs

Verificar JSON/linhas estruturadas com request ID, método, rota, status, duração e ambiente. Confirmar redaction de Authorization, cookies, CSRF, senhas, 2FA, recovery codes, tokens, grants, telefone e e-mail.

## 13. Storage/cache/URL

Redis não é fonte definitiva de usuários. Tokens e códigos não devem aparecer em URL persistente, logs, artifacts ou cache frontend.

## 14. Rollback

Rollback de aplicação deve apontar para imagem/commit anterior compatível. Não fazer merge em produção nesta sprint.

## 15. Backup e restore

Antes de homologação com dados reais de teste, executar `pg_dump`; validar restore em banco separado. Migrations destrutivas exigem plano específico e backup testado.

## 16. Incidentes

Revogar sessões no banco, rotacionar peppers/secrets se expostos, invalidar cookies via logout-all e registrar evento. Redis pode ser limpo para remover grants/rate limits, sem tratar como backup.

## 17. Critérios para staging aprovado

CI verde, smoke de infraestrutura verde, readiness real, providers configurados, cookies/CORS auditados, logs redigidos e checklist manual executado.

## 18. Critérios que impedem produção

Swagger aberto, wildcard CORS, cookies inseguros, providers memory, secrets placeholders, sem backup/restore testado, sem revisão jurídica/LGPD/pentest/profissional.

## 19. Revisão profissional

Antes de produção: dev sênior, segurança/pentest, jurídico LGPD/termos, observabilidade centralizada, plano de incidentes e revisão de infraestrutura.
