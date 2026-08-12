# Checklist atual de handoff

## Stack definida

- NestJS, PostgreSQL, Prisma e Redis;
- storage privado S3 compatível (MinIO no rehearsal);
- React, TypeScript e TanStack Start/Router no frontend.

## Reproduzir o Alpha pós-freeze

```bash
bun install --frozen-lockfile
bun run demo:prepare
bun run demo:check
bun run audit:public-foundation
```

Consulte `ALPHA_LOCAL_STABILIZATION_RUNBOOK.md`, o runbook operacional atual; não use dados reais. `LOCAL_PUBLIC_FOUNDATION_RUNBOOK.md` permanece como referência histórica e focada na fundação pública. O browser E2E completo continua pendente.

A composição staging-like e os smokes do CI são evidência técnica, não staging hospedado. Hosted staging, observabilidade e browser E2E continuam necessários no caminho até produção, mas não bloqueiam a auditoria Claude Code pre-handoff read-only nem a auditoria/orçamento humano inicial.

## Gate antes de dinheiro real

Não iniciar um “escrow simples”. Planejar e revisar conjuntamente: pedido, snapshot imutável, reserva de estoque, idempotência, ledger, gateway, webhook, split, escrow, reembolso e chargeback. Exigir CI verde, threat modeling, observabilidade, reconciliação e revisão jurídica/financeira antes de produção.

## Pendências não comerciais

- browser E2E completo;
- integrar busca e loja pública;
- planejar storage independente para KYC, disputas e evidências;
- revisar RBAC, privacidade, retenção e operação de produção.
