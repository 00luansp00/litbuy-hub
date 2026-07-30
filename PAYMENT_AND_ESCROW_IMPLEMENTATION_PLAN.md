# Plano histórico de pagamentos e retenção operacional

## Estado atual e autoridade

`COMMERCE_ARCHITECTURE.md` e `FINANCIAL_LEDGER_AND_PAYMENT_BOUNDARY.md` são os contratos vigentes. Pagamentos, wallet e ledger não estão implementados; nenhum provedor é recomendado ou selecionado. Dinheiro real exige seleção formal, revisão de segurança e validação jurídica, contábil, fiscal, LGPD e contratual.

## Métodos a avaliar

A seleção futura avaliará, sem preferência atual, Pix, boleto e cartão tokenizado, marketplace, split, retenção operacional, chargeback, webhook assinado, sandbox, KYC, saques, custos e disponibilidade contratual no Brasil. PAN e CVV não devem atravessar o backend fora de escopo PCI aplicável.

## Ledger obrigatório

Cada transação financeira cria journal imutável com duas ou mais entries balanceadas, contas e moeda explícitas. A soma dos débitos é igual à soma dos créditos. Correções usam entries compensatórias; nenhum saldo é atualizado diretamente. Saldo materializado é cache, e reconciliação compara journals com o provedor.

## Retenção documental e webhooks

Não existe prazo de retenção congelado nesta fase. A política depende de aprovação jurídica, contábil, fiscal, LGPD e contratual. Payload bruto de webhook não é armazenado por padrão: persistem-se somente campos necessários e normalizados. Exceção para raw exige finalidade, minimização, criptografia, controle de acesso e prazo formalmente aprovado.

## Controles antes de dinheiro real

Idempotência, webhook assinado, reconciliação, testes concorrentes, rollback, refunds parciais, chargebacks, KYC e auditoria externa devem ser validados. Retenção operacional não é promessa de escrow regulado ou contratual.
