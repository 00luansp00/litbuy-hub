# Seller MAX Stock Automation (I3) — CURRENT

## Autoridades e escopo

O target Owner é o benefício Seller-only por anúncio `LIT_MAX`: estoque real informado pelo
Seller, consumo por venda, pausa ao zerar e reabilitação após nova disponibilidade. I3 não é uma
feature Buyer e não altera fee, release, LP, mensagens, VIP, refund, disputa ou withdrawal.

## Reserva e consumo definitivo

Checkout continua criando `InventoryReservation ACTIVE` e calculando disponibilidade efetiva com
as reservas. A reserva não altera estoque persistido e nunca dispara auto-pause. Expiração apenas
libera a reserva, sem restock ou evento I3. O gatilho é exclusivamente o decremento definitivo e
idempotente dentro de `PaidOrderActivationService`, depois da validação do pagamento.

A autoridade MAX da venda é `Order.sellerPlanSnapshot = LIT_MAX`. `STANDARD` e snapshot legacy
ausente preservam o foundation de consumo, sem lifecycle ou marker I3.

## Modelos e pausa automática

- `NORMAL`: `Product.stock` é decrementado; zero definitivo pausa um Product `ACTIVE`.
- `DYNAMIC`: `ProductVariant.stock` é decrementado; o Product só pausa quando nenhuma variante
  `ACTIVE` — o predicate CURRENT de variante vendável — possui estoque persistido positivo.
- `SERVICE` e estoque `NULL`: não recebem comportamento artificial de inventário.

Na mesma transação de ativação, a última venda MAX muda `ACTIVE -> PAUSED`, avança uma vez a
versão, grava o marker tipado `Product.pauseReason = SELLER_MAX_OUT_OF_STOCK` e cria audit de ator
`SYSTEM`. Rollback abrange consumo, reservation, pausa, audit e ativação. Replay encontra a Order
já tratada e não repete qualquer mutação.

## Pausa manual

O status permanece a máquina CURRENT; o enum nullable `pauseReason` registra somente provenance
da pausa automática I3. `NULL` é conservador para produtos históricos e pausas manuais. Uma ação
manual de lifecycle limpa o marker; portanto restock jamais infere que um `PAUSED` antigo ou manual
deve voltar a `ACTIVE`.

## Restock Seller

`POST /api/v1/seller/products/:productId/inventory/restock` exige access token, role `SELLER`,
CSRF, SellerProfile `ACTIVE`, ownership (IDOR vira `PRODUCT_NOT_FOUND`), Product `LIT_MAX` não
`REMOVED`, estoque controlado, `quantityToAdd` inteiro positivo, `expectedVersion` e, em
`DYNAMIC`, `variantId` do próprio Product.

O incremento aditivo é uma **escolha de implementação I3**, não uma decisão histórica do Owner.
Ela evita que um set absoluto apague consumo concorrente. Uma operação lógica avança
`Product.version` uma vez; stale version retorna `PRODUCT_VERSION_CONFLICT`.

`Idempotency-Key` usa a primitive `CommerceIdempotencyRecord` com operação tipada
`SELLER_MAX_RESTOCK`: mesmo key/request retorna a resposta persistida sem nova soma, versão, audit
ou resume; payload divergente retorna `IDEMPOTENCY_KEY_REUSED`.

## Locks, auto-resume e publicação

Os caminhos I3 serializam, nesta ordem: lock da Order quando aplicável; locks
`product-lifecycle:<productId>` ordenados; locks `checkout-stock:product|variant:<id>` ordenados.
Restock usa idempotency, lifecycle e stock nessa ordem. Assim venda, restock e lifecycle manual não
perdem updates nem formam ciclos de lock.

Após restock, apenas `PAUSED + SELLER_MAX_OUT_OF_STOCK` é candidato a resume. Havendo estoque
vendável, o backend reutiliza `publicationEligibilityCode`. Se elegível, ativa e limpa o marker; se
outro blocker existir, persiste estoque, mantém `PAUSED`, limpa o marker que deixou de ser verdade e
retorna o blocker. O Seller pode corrigir o blocker e usar o lifecycle normal.
Em `DYNAMIC`, estoque positivo apenas em variante `PAUSED` ainda não é vendável: nesse caso o
Product permanece `PAUSED` e conserva `SELLER_MAX_OUT_OF_STOCK` até uma variante `ACTIVE` voltar a
ter estoque positivo.

## Auditoria, legado e futuro

Audits tipados distinguem `PRODUCT_AUTO_PAUSED_OUT_OF_STOCK` (SYSTEM),
`PRODUCT_INVENTORY_RESTOCKED` (SELLER real) e `PRODUCT_AUTO_RESUMED_AFTER_RESTOCK` (SYSTEM), com
produto, SellerProfile, Order quando aplicável, variante, quantidade, estoque, status, versão e
reason; não guardam credenciais ou headers.

Não há backfill de Orders nem de markers. Restore por refund/dispute/chargeback continua requisito
futuro fora de I3, assim como reposição artificial, cron, fornecedor externo e multi-SKU.
