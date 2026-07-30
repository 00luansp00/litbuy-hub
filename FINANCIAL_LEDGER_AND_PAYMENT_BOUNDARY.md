# Fronteira financeira, pagamento e ledger

**Status: contrato conceitual; implementação ainda não iniciada.** `COMMERCE_ARCHITECTURE.md` é a fonte autoritativa. Nenhum gateway foi selecionado e não há promessa de prontidão para dinheiro real.

## Adapter futuro

```text
createPayment
getPayment
cancelPayment
refundPayment
verifyWebhook
parseWebhook
```

A seleção formal futura avaliará Pix, boleto, cartão tokenizado, marketplace, split, recebedores, retenção, estorno, chargeback, webhook assinado, idempotência, conciliação, sandbox, KYC, saques, custos e disponibilidade contratual no Brasil. Esta lista não escolhe provedor.

## Retenção não é promessa jurídica

Distinguir sempre retenção operacional no gateway, saldo pendente no ledger interno, saldo bloqueado por disputa, saldo disponível para saque e escrow regulado/contratual somente quando efetivamente suportado. O termo não representa promessa jurídica automática.

## Ledger futuro de partidas dobradas

Lançamentos são append-only; cada transação balanceia débitos e créditos na mesma moeda (`soma dos débitos = soma dos créditos`) e unidades mínimas. Nenhum saldo sofre `UPDATE` direto: correções são lançamentos compensatórios. Saldo materializado é cache, nunca fonte de verdade. Reconciliação compara gateway e ledger. Pedido, pagamento, reembolso, chargeback e saque carregam correlação.

Contas mínimas: `gateway clearing`, `seller pending`, `seller held`, `seller available`, `platform fees`, `buyer refunds`, `withdrawal clearing`, `chargeback reserve`. Não há tabelas nesta PR.

## Webhooks

Verificar assinatura antes de processar; preservar ID único; rejeitar timestamp fora da tolerância; deduplicar e processar em transação; responder sucesso somente após persistência; permitir retry seguro; não confiar no frontend; consultar gateway em ambiguidades; não logar payload sensível.

Payload raw só pode ser armazenado com finalidade, retenção definida, proteção, minimização e avaliação LGPD — nunca por prazo arbitrário genérico.

## Reembolso versus chargeback

**Reembolso** total ou parcial é iniciado por operação autorizada, vinculado ao pagamento original, idempotente, refletido em pedido e ledger e não é mero cancelamento.

**Chargeback** nasce no provedor, pode ocorrer depois da conclusão, bloqueia ou reverte saldo, pode criar saldo negativo, exige evidências e conciliação e não reutiliza a disputa interna nem é tratado como reembolso.

## Saques

Exigem seller ativo, KYC aprovado, step-up/reautenticação, saldo disponível, limites, destino verificado, idempotência, auditoria, antifraude e conciliação. Saldo calculado pelo frontend nunca autoriza saque.

## Contrato monetário na fronteira

PostgreSQL usa `BIGINT`; TypeScript usa `bigint` ou value object. JSON usa exclusivamente string decimal canônica em `amountMinor`, apenas dígitos e sem sinais, ponto, expoente, espaços ou zeros não canônicos. Número JSON e serialização direta de `bigint` são proibidos; moeda e validação backend são obrigatórias.

## Pagamento tardio após expiração

Confirmação após expiração é persistida idempotentemente e verificada no gateway quando necessário. O pedido expirado não é reativado; reserva liberada não é consumida novamente; entrega e recriação artificial de estoque são proibidas. Abre-se incidente de reconciliação, cuja resolução autorizada e auditada pode realizar refund automático ou tratamento operacional. Nenhum estado muda silenciosamente.
