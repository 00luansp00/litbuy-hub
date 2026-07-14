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
