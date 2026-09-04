# Z — Dispute pre-release block

## Escopo implementado

Z integra a fundação persistente `DisputeCase` aos dois gates financeiros já existentes, sem
sincronizar artificialmente `Order.disputeStatus` e sem criar uma movimentação financeira nova.
`DisputeCase` é a autoridade para casos persistentes; o agregado legado permanece somente como
blocker conservador de compatibilidade para Orders históricos.

## Regra financeira compartilhada

`DisputeReleaseBlockerService` consulta casos dentro do `Prisma.TransactionClient` do gate. Os
status `OPEN`, `UNDER_REVIEW`, `RESOLVED_BUYER` e `CLOSED` bloqueiam. A política é fail-closed:
somente `RESOLVED_SELLER` deixa de bloquear por si só. Todos os casos históricos são considerados,
portanto qualquer histórico Buyer-win ou `CLOSED`, bem como qualquer caso ativo, prevalece sobre
históricos Seller-win.

`Order.disputeStatus` não foi removido nem relaxado: seus quatro status bloqueadores continuam
impedindo release, enquanto `NONE` ou `RESOLVED_SELLER` jamais neutralizam um blocker persistente.
Não houve backfill, trigger de cópia ou migration.

## Gates G1 e G2

- G1 (`ACTIVE` → `RELEASE_ELIGIBLE`) adquire `FOR UPDATE` na row de Order, consulta o blocker
  persistente na mesma transaction e retorna `BUSINESS_BLOCKED` sem reconciliation issue.
- G2 (`RELEASE_ELIGIBLE` → `RELEASED`) preserva seu lock de Order e revalida o mesmo blocker antes
  do posting `SELLER_FUNDS_RELEASED`. Quando bloqueado, não altera hold, `releasedAt`, posting ou
  saldo `SELLER_AVAILABLE`.
- As seleções batch de ambos os gates excluem blockers persistentes conhecidos, mas `processOne()`
  continua sendo a autoridade transacional e revalida depois da seleção.

Uma decisão `RESOLVED_SELLER` não recalcula nem reinicia prazo: antes do effective release date o
resultado continua `NOT_DUE`; depois da data, sem outro blocker, G1 pode tornar o hold imediatamente
elegível e G2 pode executar. `RESOLVED_BUYER` e `CLOSED` preservam o dinheiro em hold; seu destino não
é decidido por Z.

## Boundary concorrente e pós-release

`OrdersService.reportProblem`, G1 e G2 compartilham a row lock `Order ... FOR UPDATE`. O reporting
mantém primeiro seu advisory lock de idempotência e, depois de resolver ownership, adquire a row
lock antes de materializar `DisputeCase`. Um no-op update da própria row cria uma nova versão MVCC,
sem alterar dado de domínio, para que um gate `SERIALIZABLE` com snapshot anterior obrigatoriamente
faça retry em vez de deixar de enxergar o novo child case. Assim há uma ordem de commit autoritativa:

1. report-first materializa `OPEN`; G1/G2 esperam e depois observam o blocker;
2. release-first conclui HELD → AVAILABLE; o report vitalício posterior cria o caso, sem desfazer a
   release válida.

O replay de um hold já `RELEASED` continua validando a release histórica e retorna
`ALREADY_RELEASED`, mesmo diante de uma disputa pós-release.

## Fora de escopo

Z não implementa decisão/Admin, refund, fee reversal, deficit, reservation, recovery, payout,
withdrawal blocker ou PSP refund. Abrir uma disputa não cria Ledger transaction, debit ou credit.
O tratamento pós-release permanece reservado a `DISPUTE-POST-RELEASE-RECOVERY`.
