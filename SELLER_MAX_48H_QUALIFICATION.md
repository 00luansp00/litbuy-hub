# Seller MAX — qualificação de confirmação em 48 horas (CURRENT J)

## Autoridades e escopo

Esta implementação prospectiva materializa, por venda, a capability J. A única autoridade para aplicar J é `Order.sellerPlanSnapshot = LIT_MAX`; o plano atual do Product nunca é consultado. A entrega autoritativa é `OrderDelivery.createdAt`, criada pelo PostgreSQL na transação Seller. A confirmação usa `transaction_timestamp()` do PostgreSQL, capturado sob o mesmo advisory transaction lock `order:<orderId>` da progressão de fulfillment. DTOs não recebem timestamps.

J somente decide qualificação. Ela não calcula redução, `maxTargetAt` ou `effectiveReleaseAt`, não altera `FinancialHold.releaseEligibleAt` e não antecipa dinheiro. K (`SELLER-MAX-RELEASE-CALC`) continua não implementada.

## Snapshot v1 e estados

Na mesma transação que cria uma nova entrega LIT_MAX, o Order recebe versão `1`, estado `PENDING` e deadline igual a `OrderDelivery.createdAt + interval '48 hours'`. `buyerConfirmedAt` e `sellerMaxQualificationDecidedAt` permanecem nulos. STANDARD e snapshot legado nulo não recebem campos MAX.

Na confirmação Buyer válida, o timestamp DB é gravado uma única vez. A comparação é inclusiva e em precisão de milissegundos: `buyerConfirmedAt <= deadlineAt` produz `QUALIFIED`; um milissegundo depois produz `EXPIRED`. A decisão e `FULFILLMENT_CONFIRMED` pertencem à mesma transação. Confirmação tardia continua válida para fulfillment.

O batch mínimo seleciona somente v1 `PENDING`, sem confirmação, quando DB now é **estritamente maior** que o deadline. Sob o mesmo lock do Order, decide `EXPIRED`. Exatamente no deadline não expira. Infraestrutura de scheduler não faz parte desta PR.

`QUALIFIED` e `EXPIRED` são terminais. Depois de expiração automática, uma confirmação tardia pode preencher `buyerConfirmedAt`, mas não muda status, deadline ou `decidedAt`. Replays de delivery, confirmação e batch não criam nova janela, timestamp, decisão, incremento ou evento.

## Auditoria, concorrência e invariants

As transições criam um `OrderEvent` e um `OutboxEvent` com topics `seller_max.qualification_started`, `seller_max.qualified` e `seller_max.qualification_expired`. Metadata é limitada a IDs/timestamps da regra, versão, estados, role e reason estável; não contém evidência, referência segura ou credenciais.

Constraints PostgreSQL validam o shape v1/MAX-only, campos obrigatórios por estado e a relação temporal de QUALIFIED/EXPIRED. Trigger valida deadline diretamente contra a entrega e impede mudança de versão, deadline, timestamp de confirmação e estado terminal. O lock compartilhado serializa confirmation versus expiry e workers concorrentes. Delivery e confirmation reutilizam os increments já existentes; expiry é uma nova transição durável e incrementa `Order.version` uma vez.

## Legacy e finanças

A migration não executa backfill. Orders entregues, confirmadas ou concluídas antes de J permanecem com campos J nulos; replay não infere estado pelo Product nem reconstrói timestamps. Somente uma nova entrega autoritativa pós-J pode iniciar v1.

O relógio base G1/G2 permanece `OrderDelivery.createdAt + frozenBaseReleaseDelayHours`. Buyer inerte não impede eligibility base, e nenhuma decisão J modifica ou executa o hold. Não fazem parte deste incremento: K, mensagens automáticas/AK2, LP, Buyer VIP, rating financeiro, refund/reversal, withdrawal/payout, PSP, KYC ou nova infraestrutura cron.
