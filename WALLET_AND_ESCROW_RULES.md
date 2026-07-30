# Regras futuras de saldo e retenção operacional

## Estado atual e autoridade

`COMMERCE_ARCHITECTURE.md` e `FINANCIAL_LEDGER_AND_PAYMENT_BOUNDARY.md` são autoritativos. Não existe wallet ou ledger financeiro implementado. Telas atuais exibem saldo projetado demonstrativo; nenhuma retenção é promessa jurídica de escrow regulado ou contratual.

## Fonte de verdade e projeções

- contas e journals do ledger de partidas dobradas serão a fonte de verdade;
- cada transação gera journal imutável com duas ou mais entries balanceadas;
- a soma dos débitos é igual à soma dos créditos, com conta e moeda explícitas;
- nenhuma entry isolada representa ledger completo;
- saldo materializado é apenas cache reconstruível;
- saldo projetado pela UI é apresentação não autoritativa e nunca autoriza mutação.

## Estados conceituais

`pending`, `held` e `available` representam contas distintas no ledger futuro. Disputa pode mover valor por entries balanceadas; correções são compensatórias, sem update direto de saldo.

## Saques

KYC aprovado é obrigatório para qualquer saque real. Também são exigidos seller ativo, step-up/reautenticação, saldo disponível, limites, conta de destino verificada, idempotência, auditoria, antifraude e conciliação.

## Reembolso e chargeback

Refund parcial ou total segue registros próprios e limite agregado transacional. Chargeback é independente, pode bloquear/reverter saldo e gerar saldo negativo. Nenhum desses fluxos está implementado.

## Estado visual legado útil

`/vendedor/financeiro`, `/admin/transacoes`, Saldo LIT e LIT Points permanecem demonstrativos. LIT Points não são dinheiro nem saldo sacável. Nenhuma tela ou service mockado constitui fonte financeira.
