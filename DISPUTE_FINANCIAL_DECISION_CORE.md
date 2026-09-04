# AA0 — Dispute Financial Decision Core

## Autoridade e limite econômico

`RESOLVED_BUYER` prova somente o resultado terminal do lifecycle de uma `DisputeCase`; não determina valor, liability, funding, deficit, refund ou payout. AA0 materializa separadamente uma autoridade imutável sobre **principal de produto decidido**, sem movimentar dinheiro.

O principal autoritativo é `Order.subtotalAmountMinor - Order.discountAmountMinor`. Ele não é `Order.totalAmountMinor`: uma cobrança Buyer VIP é Buyer-side e fica excluída. Listing Tier e Seller MAX não são subtraídos do principal; seus snapshots tampouco são recalculados ou revertidos. Isso preserva a separação entre principal decidido e a futura decomposição de Seller liability.

`TOTAL` exige que o valor decidido seja exatamente o snapshot de principal. `PARTIAL` exige valor positivo e estritamente inferior. A soma das decisões de todos os casos históricos do mesmo Order nunca pode exceder o principal do Order.

## Boundary pós-release

A criação exige um caso terminal `RESOLVED_BUYER` e evidência persistida de release legítimo de proceeds positivos: `FinancialHold(DELIVERY_PROTECTION, RELEASED)` com timestamps/referências e o `LedgerTransaction` de release coerentes. Status do Order ou mera elegibilidade temporal não bastam. Vendas sem proceeds/release positivo falham fechadas.

Order, Buyer e Seller são derivados de `DisputeCase -> Order`; o caller não os fornece. O ator precisa possuir `PlatformRole.ADMIN`, verificado no service e novamente no banco.

## Auditoria, concorrência e idempotência

A row guarda case, Order, Buyer, Seller, tipo, principal original, principal decidido, BRL, ator, hashes de idempotência/request e timestamps PostgreSQL. Uma chave do mesmo ator e request retorna a mesma row; reutilização com outro request conflita; outra chave para o mesmo case também conflita. A evidência não expira.

Transactions `SERIALIZABLE`, advisory lock da chave e `Order FOR UPDATE` serializam replay e o limite cumulativo. O trigger também toma lock por Order, recalcula invariantes e o acumulado para inserts SQL diretos. Triggers rejeitam todo `UPDATE` e `DELETE`; `executableAt` e `createdAt` são impostos pelo relógio transacional PostgreSQL.

## O que AA0 não autoriza

AA0 não cria `Refund`, Ledger posting, `FinancialEvent`, Outbox, reservation, `SELLER_DEFICIT`, payout, fee reversal, recovery claim ou FIFO. Uma decisão de Order legacy não autoriza um engine futuro a presumir tratamento de `PLATFORM_COMMISSION`; a execução futura deve falhar fechada quando não conseguir reconciliar a economia histórica.

As próximas capabilities ainda precisam decompor Seller liability, reservar/recover funds, materializar apenas deficits legítimos, ordenar execução e entregar valor ao Buyer. Portanto `DISPUTE-POST-RELEASE-RECOVERY` permanece `NOT_IMPLEMENTED`.
