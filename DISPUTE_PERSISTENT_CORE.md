# Dispute Persistent Core

**Capability:** X — `DISPUTE-PERSISTENT-CORE` · **estado:** `IMPLEMENTED`

## Autoridade e propósito

`DisputeCase` é a autoridade persistente para casos de disputa e `DisputeCaseEvent` é a trilha de lifecycle. O backend recebe somente a identidade autoritativa do `Order` e, quando aplicável, do actor já autenticado; Buyer e Seller são derivados das relações existentes do Order, não copiados de payload.

## Lifecycle e invariantes

Todo caso nasce em `OPEN`. `OPEN` pode seguir para `UNDER_REVIEW` ou para um estado terminal; `UNDER_REVIEW` pode seguir somente para um estado terminal. `RESOLVED_BUYER`, `RESOLVED_SELLER` e `CLOSED` são terminais. Não há reabertura nem transição entre terminais: um problema posterior cria outro caso e preserva o anterior.

`OPEN` e `UNDER_REVIEW` são ativos. Um índice único parcial PostgreSQL em `DisputeCase(orderId)` para esses dois estados garante no máximo um ativo por Order, inclusive quando requisições concorrentes ignoram qualquer pré-checagem de aplicação. A FK `DisputeCase.orderId → Order.id` é restritiva e Orders existentes não recebem backfill.

Triggers PostgreSQL validam o estado inicial, a state machine, timestamps e identidade imutável. Assim, escrita SQL/Prisma fora do service também falha fechada. O service interno serializa transições com `SELECT ... FOR UPDATE`; ele não é controller nem endpoint Buyer.

## Auditoria

O banco materializa `CASE_OPENED` no insert e `STATUS_CHANGED` em cada transição, contendo caso, Order, estado anterior/novo, actor opcional e timestamp do banco. Eventos não podem sofrer `UPDATE` ou `DELETE`; casos também não podem ser apagados. Correções futuras devem acrescentar um evento/transição autorizada, nunca adulterar evidência existente.

## Compatibilidade e boundaries

`Order.disputeStatus` é preservado sem backfill e continua sendo apenas o agregado legado consumido pelo fulfillment e Seller release atuais. X não sincroniza o novo core com esse campo e não muda blockers financeiros: essa integração é exclusivamente Z. Portanto não existem duas authorities financeiras nesta capability; o lifecycle de casos é `DisputeCase`, enquanto o release mantém deliberadamente seu comportamento legado até Z.

Esta capability não fornece “Reportar problema” (Y), API/UI pública, mediação Admin, notices/chat, SLA, release blocker persistente (Z), Ledger posting, refund, recovery, deficit ou qualquer movimentação financeira.
