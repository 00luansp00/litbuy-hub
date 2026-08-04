# Snapshot da comissão da plataforma no checkout

## Autoridade e resolução

A política versionada persistida é a única autoridade financeira do checkout. Um único `pricingAt`, obtido por `transaction_timestamp()` dentro da transação PostgreSQL, seleciona exatamente uma `FeePolicyVersion` com status `ACTIVE`, `effectiveFrom <= pricingAt` e `effectiveTo` ausente ou posterior a `pricingAt`. A versão é relida sob `FOR SHARE`, seu status e intervalo são revalidados e suas regras são carregadas na mesma transação.

Nenhuma política efetiva produz `FEE_POLICY_NOT_FOUND`; mais de uma produz `FEE_POLICY_AMBIGUOUS`. A ausência de uma regra aplicável produz `PLATFORM_COMMISSION_RULE_NOT_FOUND`. Todos falham fechados e revertem integralmente o checkout. Taxa zero não é fallback: exige uma regra explícita cujo cálculo resulte em zero.

## Regra econômica

O checkout resolve `PLATFORM_COMMISSION`, cobrada de `SELLER`, por `resolveFeeRule()` e calcula uma única vez sobre o subtotal agregado por `calculateFee()`. O contexto ainda não possui método de pagamento, parcelas, nível/plano do seller, promoção, velocidade de saque ou tipo de produto; por isso nenhum valor é presumido e regras com esses qualificadores não casam nesta etapa.

O cálculo permanece em `bigint`, BRL e basis points inteiros com arredondamento para baixo, além de mínimo e máximo da regra. A comissão não altera subtotal nem total do comprador: `totalAmountMinor = subtotalAmountMinor`. Se a comissão exceder subtotal ou total, o checkout falha com `PLATFORM_COMMISSION_EXCEEDS_ORDER_TOTAL`, sem limitar silenciosamente. O futuro líquido do seller é derivado por `totalAmountMinor - platformFeeAmountMinor`.

## Snapshot e imutabilidade

Todo pedido novo congela `feePolicyVersionId`, `platformCommissionRuleId`, `pricingPolicyVersion` (o `publicVersion` da política) e `platformFeeAmountMinor`. Cada `OrderItem` congela o mesmo `pricingPolicyVersion`; não existe fee por item ou rateio nesta etapa. As referências são opcionais no schema apenas para compatibilidade com pedidos legados e usam exclusão restrita.

Pedidos antigos não são recalculados. Replay idempotente retorna o resultado já persistido antes de consultar uma política nova, portanto aposentadoria ou publicação posterior não altera versão, regra ou valor do pedido original.

## Limite contábil

Esta entrega não cria `LedgerTransaction`, `LedgerEntry`, `FinancialEvent`, settlement, hold, conta ou integração PSP. O `ORDER_CREATED` comercial continua sendo o evento do checkout. O próximo incremento reconhecerá contabilmente o fluxo `PROVIDER_CLEARING -> SELLER_PENDING -> PLATFORM_COMMISSION` após pagamento confirmado.
