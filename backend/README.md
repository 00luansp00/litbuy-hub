# LIT Buy Backend

Fundação técnica da API do LIT Buy, criada como monólito modular NestJS em TypeScript.

## Escopo desta sprint

Inclui apenas infraestrutura de base:

- NestJS com TypeScript strict.
- API REST com prefixo global `/api/v1`.
- Configuração validada por variáveis de ambiente.
- Prisma configurado para PostgreSQL, sem modelos comerciais.
- Módulo Redis, sem filas de negócio.
- Health checks de liveness e readiness.
- Tratamento global de erros com `requestId`.
- Swagger em `/docs`, controlado por `SWAGGER_ENABLED`.
- Docker Compose de desenvolvimento com PostgreSQL e Redis.

Não inclui autenticação, usuários, anúncios, pedidos, pagamentos, carteira, LIT Points, chat, WebSocket ou filas de negócio.

## Variáveis de ambiente

Copie `.env.example` para `.env` e ajuste somente valores locais de desenvolvimento.

| Variável          | Finalidade                                        |
| ----------------- | ------------------------------------------------- |
| `NODE_ENV`        | Ambiente: `development`, `test` ou `production`.  |
| `PORT`            | Porta HTTP da API.                                |
| `API_PREFIX`      | Prefixo global da API. Padrão esperado: `api/v1`. |
| `DATABASE_URL`    | URL PostgreSQL usada pelo Prisma.                 |
| `REDIS_URL`       | URL Redis.                                        |
| `CORS_ORIGINS`    | Lista separada por vírgula de origens permitidas. |
| `LOG_LEVEL`       | Nível de log.                                     |
| `SWAGGER_ENABLED` | Habilita Swagger quando `true`.                   |

## Comandos

```bash
bun install
bun run dev
bun run lint
bun run format:check
bun run typecheck
bun run test
bun run test:e2e
bun run prisma:validate
bun run prisma:generate
bun run build
```

## Docker de desenvolvimento

```bash
cp .env.example .env
bun run prisma:generate
docker compose up -d
bun run dev
```

Serviços:

- PostgreSQL: `localhost:5432`
- Redis: `localhost:6379`

## Endpoints

- `GET /api/v1/health/live`
- `GET /api/v1/health/ready`
- `GET /docs` quando `SWAGGER_ENABLED=true`

## Sprint 2A — identidade e autenticação

A API expõe `/api/v1/auth/register`, `/email/verify`, `/email/resend`, `/login`, `/device/approve`, `/device/resend`, `/refresh`, `/logout` e `/me`.

A implementação usa senha Argon2id, JWT de acesso curto, refresh token opaco rotacionado e armazenado somente como HMAC, dispositivo opaco em cookie HttpOnly, CSRF double-submit para refresh/logout, sessões persistidas no PostgreSQL e eventos de segurança sanitizados. O rate limit usa Redis e falha aberto em indisponibilidade temporária para preservar disponibilidade local, sem armazenar senha ou token nas chaves.

O envio de e-mail fica atrás de `AuthMailer`; `memory` é usado em testes/desenvolvimento e `console` é bloqueado em produção sem provedor comercial real.

Novas variáveis: `AUTH_ACCESS_TOKEN_SECRET`, `AUTH_ACCESS_TOKEN_TTL_SECONDS`, `AUTH_REFRESH_TOKEN_TTL_DAYS`, peppers de refresh/verificação/dispositivo/CSRF/IP, TTLs de confirmação e aprovação, limites de tentativas, nomes/configuração de cookies, `AUTH_EMAIL_DELIVERY_MODE`, `CURRENT_TERMS_VERSION` e `CURRENT_PRIVACY_VERSION`.

Prisma agora contém `User`, `PasswordCredential`, `Device`, `Session`, `VerificationChallenge` e `SecurityEvent`. Use `bun run prisma:migrate:deploy` em CI/produção e `bun run prisma:migrate:status` para inspeção.
