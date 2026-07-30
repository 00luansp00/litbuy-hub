# Checklist atual de handoff

## Stack definida

- NestJS, PostgreSQL, Prisma e Redis;
- storage privado S3 compatível (MinIO no rehearsal);
- React, TypeScript e TanStack Start/Router no frontend.

## Reproduzir a fundação pública

```bash
bun install --frozen-lockfile
bun run demo:prepare
bun run demo:check
bun run audit:public-foundation
```

Consulte `LOCAL_PUBLIC_FOUNDATION_RUNBOOK.md`; não use dados reais.

## Gate antes de dinheiro real

Não iniciar um “escrow simples”. Planejar e revisar conjuntamente: pedido, snapshot imutável, reserva de estoque, idempotência, ledger, gateway, webhook, split, escrow, reembolso e chargeback. Exigir CI verde, threat modeling, observabilidade, reconciliação e revisão jurídica/financeira antes de produção.

## Pendências não comerciais

- browser E2E completo;
- integrar busca e loja pública;
- planejar storage independente para KYC, disputas e evidências;
- revisar RBAC, privacidade, retenção e operação de produção.
