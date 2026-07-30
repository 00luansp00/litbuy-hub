# LIT Buy

Marketplace em evolução com uma fundação pública **híbrida**: autenticação, lifecycle de anúncios e catálogo público já usam o backend real; superfícies comerciais ainda são demonstrativas.

## Estado atual

### Integrações reais

- backend NestJS, PostgreSQL, Prisma, Redis e autenticação auditada;
- lifecycle de anúncios e leitura pública de categorias, listagem e detalhe;
- MinIO/S3 compatível privado, com imagens entregues por URLs assinadas temporárias;
- dataset local determinístico;
- Home, categoria e detalhe de produto conectados ao backend local.

### Superfícies demonstrativas

Busca, loja pública, favoritos, carrinho, checkout, pedidos, pagamentos e outras superfícies legadas continuam mockadas. Elas não devem ser interpretadas como comércio funcional e não devem receber dados pessoais ou financeiros reais.

## Stack confirmada

React 19, TypeScript, Vite 8, TanStack Start/Router, NestJS, PostgreSQL, Prisma, Redis, MinIO/S3, Docker Compose e GitHub Actions.

## Como executar

### Frontend isolado

Útil para trabalho visual; as chamadas reais exigem uma API configurada.

```bash
bun install --frozen-lockfile
bun run dev
```

### Rehearsal completo

```bash
bun install --frozen-lockfile
bun run demo:prepare
```

Siga o passo a passo seguro em [`LOCAL_PUBLIC_FOUNDATION_RUNBOOK.md`](./LOCAL_PUBLIC_FOUNDATION_RUNBOOK.md).

## Login local

Contas públicas, fictícias e exclusivamente locais (senha `LitBuyDemo2026!`):

- `comprador@demo.litbuy.local`
- `vendedor@demo.litbuy.local`
- `admin@demo.litbuy.local`

Essas credenciais são descartáveis e proibidas em produção. Não é permitido entrar com senha arbitrária.

## Rotas e documentação

- Home `/`, categoria `/categoria/$slug` e detalhe `/produto/$id` usam catálogo público real (o parâmetro legado `$id` contém um slug).
- Busca `/buscar`, loja `/loja/$slug`, carrinho `/carrinho` e checkout `/checkout` são demonstrativos.
- Consulte [`PUBLIC_FOUNDATION_FINAL_AUDIT.md`](./PUBLIC_FOUNDATION_FINAL_AUDIT.md), [`ROUTES_MAP.md`](./ROUTES_MAP.md) e [`SERVICES_MAP.md`](./SERVICES_MAP.md).

O backend é a fonte de verdade. Nenhuma tela demonstrativa implica prontidão para produção, pagamento, escrow ou proteção comercial.
