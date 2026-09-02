# Buyer — Reportar problema

**Capability:** Y — `BUYER-REPORT-PROBLEM` · **estado:** `IMPLEMENTED`

## Contrato HTTP e autoridade

`POST /api/v1/orders/:orderCode/report-problem` abre um caso e `GET /api/v1/orders/:orderCode`
é o read model usado também após refresh. As duas rotas exigem access token e role `BUYER`; a mutation
também exige o CSRF persistido da sessão. O payload não recebe identidade, status, motivo ou actor.
O header `Idempotency-Key` é obrigatório e validado pelo parser Commerce compartilhado.

O backend procura `Order` pela combinação `publicCode + buyerUserId`, sendo `buyerUserId` exclusivamente
`CurrentUser.userId`. Recurso inexistente e Order alheio produzem a mesma resposta `ORDER_NOT_FOUND` (404),
sem confirmação de existência. O UUID interno do Order não é aceito pela API.

## Eligibility e lifecycle

O reporting é vitalício e não possui gate por estado do Order, idade, entrega, confirmação,
`sellerReleaseEligibleAt`, saldo `SELLER_AVAILABLE`, VIP, categoria ou SLA. As únicas condições são Order
existente, ownership Buyer e ausência de caso ativo. Esta escolha não atribui semântica financeira a Orders
pré-pagamento: a autoridade disponível não autorizou um gate de lifecycle inicial, portanto nenhum foi
inventado.

Cada intenção usa `CommerceIdempotencyOperation.BUYER_REPORT_PROBLEM`. Buyer, operação e hash da key são
serializados por advisory lock; o request hash canônico contém o `orderCode`. Caso e resposta idempotente são
gravados na mesma transação. Um replay da mesma intenção retorna a resposta concluída mesmo se o caso já tiver
chegado a terminal, enquanto reutilizar a key em outro Order retorna `IDEMPOTENCY_KEY_REUSED`. O frontend
preserva a key durante falhas/retries e a descarta somente após sucesso definitivo, permitindo que uma intenção
realmente nova use outra key. O registro desta operação não recebe expiração operacional curta, pois remover a
intenção permitiria que um replay tardio criasse outro caso depois da resolução.

A abertura delega a `DisputeCoreService.createCase`, sempre cria `OPEN` e deixa o trigger do core
materializar `CASE_OPENED` com o Buyer autenticado como actor. O índice parcial PostgreSQL continua sendo a
última defesa contra dois casos `OPEN`/`UNDER_REVIEW`; uma nova tentativa enquanto há caso ativo retorna 409. Depois que o caso anterior é terminal, uma nova abertura cria outra linha, preservando todo o histórico.

## Read model e UI

O read Buyer do Order expõe somente `caseId`, status, timestamps e histórico de casos daquele Order já
protegido por ownership. A página real de detalhe exibe “Reportar problema”, bloqueia double-click durante a
mutation, informa erro/sucesso e substitui a ação pelo estado ativo persistido. Uma nova leitura recupera o
mesmo estado do PostgreSQL; mock/support não é authority.

## Boundaries financeiras

`DisputeCase` permanece a authority do lifecycle. `Order.disputeStatus` não é escrito, sincronizado nem usado
para eligibility por Y. Seller release, `FinancialHold`, Ledger, saldos, refund, deficit e recovery não são
consultados nem modificados. Em particular, Y não implementa Z (`DISPUTE-PRE-RELEASE-BLOCK`): abrir um caso
registra o problema, mas ainda não bloqueia ou promete qualquer movimento financeiro.

Nenhuma migration foi necessária; Y reutiliza integralmente o schema e a constraint publicados por X.
