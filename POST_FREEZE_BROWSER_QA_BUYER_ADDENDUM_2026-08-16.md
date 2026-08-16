# LIT Buy — Browser QA Buyer Addendum — 2026-08-16

## Finalidade

Este arquivo preserva **atualizações intermediárias do Browser QA encontradas durante o Bloco 3 — Buyer** antes do encerramento formal do bloco.

Ele existe porque o ledger principal `POST_FREEZE_BROWSER_QA_FINDINGS.md` ainda contém estados anteriores a uma reprodução limpa, correção e revalidação realizadas durante a bateria Buyer.

Até o fechamento documental do Bloco 3, este addendum **prevalece somente para os itens explicitamente listados abaixo** quando houver divergência de estado/evidência com o texto antigo do ledger principal.

No fechamento do bloco, estas informações devem ser incorporadas ao ledger principal e este addendum poderá permanecer apenas como evidência histórica.

Este arquivo não altera escopo Alpha, não autoriza Phase B e não transforma `NON_BLOCKER` em trabalho imediato.

---

# QA-BROWSER-003 — tela de pagamento stale após aprovação Alpha

- **Tipo:** frontend / cache / mutation state / UX
- **Estado final:** `CLOSED — comportamento atual revalidado`
- **Impacto:** `NON_BLOCKER`
- **Área:** `/pagamento/$id`

## Evidência histórica preservada

No pedido histórico `LIT-SELPYT2KNHNTYH`, após aprovação Alpha, a tela chegou a exibir combinação visual stale enquanto o backend já tinha progredido corretamente.

Essa observação continua válida como evidência histórica.

## Evidência nova — 2026-08-16

Após a correção independente do `QA-BROWSER-004`, um pedido novo (`LIT-5TA2XY8Y3U8ARK`) foi aprovado em `FAKE_ALPHA`.

Antes de qualquer `F5`, a tela atualizou para:

- `Order = ACTIVE`;
- `Payment = PAID`;
- `Attempt = SUCCEEDED (#1)`.

Depois de `F5`, o estado permaneceu correto.

Portanto o stale pós-aprovação **não se reproduziu** nessa rodada limpa.

## Limite da conclusão

A PR #87 **não alterou frontend/cache**. Logo, não atribuir a ela uma correção do `QA-BROWSER-003`.

Também houve uma observação transitória em outro pedido em que a tela mostrou `Não criado` ao mesmo tempo em que já existia tentativa `PENDING (#1)`; após `F5`, passou a `PENDING` coerente.

Disposição final no fechamento Buyer:

- o comportamento limpo atual não reproduziu o finding;
- o histórico stale permanece preservado;
- a PR #87 não é apresentada como correção;
- `CLOSED — comportamento atual revalidado`.

---

# QA-BROWSER-004 — FAKE_ALPHA reutiliza externalPaymentId após restart

- **Tipo:** payment orchestration / fake provider / restart safety
- **Estado:** `CLOSED`
- **Impacto anterior:** `CURRENT_BLOCKER` do pagamento Alpha local
- **Impacto atual:** blocker removido no rehearsal local
- **Área:** `/pagamento/$id` + backend fake/local

## Reprodução limpa

Pedido:

`LIT-XUNGUU93ADSY33`

Condições:

- pedido novo;
- dentro do prazo;
- uma única ação `Iniciar pagamento Alpha`;
- sem F5/replay antes do erro.

Resultado:

`RECONCILIAÇÃO DE PAGAMENTO NECESSÁRIA`

Banco:

- `PaymentAttempt #1 = PENDING`;
- `providerCode = FAKE_ALPHA`;
- `externalPaymentId = null`;
- `ReconciliationIssue = OPEN`;
- details reason = `PROVIDER_SUCCEEDED_LOCAL_PERSISTENCE_FAILED`.

## Causa-raiz

`FakePaymentProvider` gerava IDs por contador em memória:

`fake_payment_1`, `fake_payment_2`, ...

Após restart, o contador voltava a zero e podia reutilizar um ID histórico persistido.

A unique constraint `(providerCode, externalPaymentId)` detectava corretamente a colisão.

A reconciliação fail-safe também se comportava corretamente.

O defeito era a estratégia de external ID do provider fake/local.

## Correção

PR #87:

`fix(payments): make FAKE_ALPHA external ids restart-safe`

Head final validado:

`33bcddedcd9cd2fae0a747ebac959d11c97bc7f8`

Merge commit:

`877c8c07246b9acae94fbc33bc568363df2c724b`

Nova estratégia:

`fake_payment_<sha256(idempotencyHash)>`

Sem alteração de:

- Prisma/schema/migrations;
- unique constraints;
- Ledger;
- `SaleFinancialRecognition`;
- Payment/Order state machines;
- reconciliação;
- PSP real;
- frontend;
- Phase B.

## Evidência automatizada

- teste focado: 4/4;
- backend: 46 suítes / 610 testes;
- typecheck/lint/prettier/diff-check aprovados;
- CI #330: sucesso no commit correto;
- CI #332: sucesso após reset da branch para o commit correto.

## Evidência manual pós-fix

Pedido `LIT-DRJB56BEU7TWVN`:

- `Iniciar pagamento Alpha` → `PENDING (#1)`;
- sem reconciliação;
- `F5` preservou a mesma tentativa #1.

Pedido `LIT-5TA2XY8Y3U8ARK`:

- aprovação Alpha → `ACTIVE / PAID / SUCCEEDED (#1)` antes do F5;
- F5 preservou estado;
- `externalPaymentId = fake_payment_ae4a116776b33e677e12f00df490ec00b028a09c10dd8479bdf7fd4e6b3602c8`;
- nenhuma reconciliação do payment attempt;
- `SALE_RECOGNIZED = 1`;
- `PROVIDER_CLEARING DEBIT = 10000`;
- `SELLER_PENDING CREDIT = 10000`;
- nenhuma reconciliação financeira `OPEN`.

## Limite

`CLOSED` significa corrigido para `FAKE_ALPHA`/rehearsal local.

Não significa:

- PSP real homologado;
- dinheiro real;
- staging hospedado;
- PASS2-F1 produtivo encerrado;
- scheduler/worker produtivo validado.

---

# QA-BROWSER-007 — intenção de destino é perdida durante autenticação

- **Tipo:** frontend / auth redirect / buyer conversion
- **Estado:** `OPEN`
- **Impacto:** `NON_BLOCKER`

## Evidência ampliada no Buyer

A observação original:

`Produto real → Entrar para comprar → Login → Home`

foi ampliada com:

`/carrinho` deslogado → Login → Home

em vez de retorno ao carrinho.

Isso indica que o problema não deve ser descrito somente como “produto perde intenção”; a aplicação não preserva genericamente o destino/intenção protegida que levou o usuário ao login.

Uma correção futura deve preservar intenção sem auto-add silencioso e sem replay de mutation.

---

# QA-BROWSER-013 — pedido vencido permanece visualmente acionável antes da materialização de expiração

- **Tipo:** order expiration / payment UX / operational consistency
- **Estado:** `OPEN`
- **Impacto:** `NON_BLOCKER` no rehearsal local; relevante antes de produção
- **Área:** pedido/pagamento Buyer

## Observação

Pedido:

`LIT-XDBTWRNE9CJ6KX`

O deadline já tinha vencido, mas antes de executar o processador de expiração a UI ainda podia manter aparência/ação de pagamento disponível.

Ao tentar pagar, o backend rejeitou corretamente com:

`PEDIDO NÃO ELEGÍVEL PARA PAGAMENTO`

Logo:

- guard server-side de deadline: aprovado;
- coerência visual/materialização operacional: finding aberto.

## Processador validado

A rotina real de expiração foi executada no container runtime com:

```bat
docker compose -f docker-compose.staging.yml exec backend node dist/orders/order-expiration.cli.js
```

Saída observada:

```json
{"examined":3,"expired":3}
```

Depois de `F5`, o pedido exibiu `Pedido expirado` e o botão de pagamento desapareceu.

## Nota operacional

O script de `package.json` baseado em `ts-node src/orders/order-expiration.cli.ts` não é executável dentro da imagem runtime auditada porque a imagem não inclui `/src`.

A imagem contém o código compilado em `/dist`.

Também não foi comprovado executor automático ativo por default no rehearsal local.

Não inventar worker/cron/scheduler de produção a partir da mera existência da CLI/service.

## Critério futuro

Antes de produção, alinhar:

- materialização operacional de expirations;
- UX de deadline já vencido;
- responsabilidade do executor;
- observabilidade/retry/idempotência da execução apropriada;
- sem relaxar o guard server-side já correto.

---

# Regra de continuidade após este addendum

O `QA-BROWSER-004` era um blocker que impedia continuar o Buyer; por isso foi corrigido antes da remediação consolidada.

Após seu merge:

> **retornar ao Bloco 3 — Buyer no ponto interrompido.**

Não iniciar agora correções em massa de findings `NON_BLOCKER`.

A política detalhada anti-loop e de retorno ao trilho principal está em `FINAL_FUNCTIONAL_AUDIT_REMEDIATION_GATE.md`.

# Fechamento do addendum Buyer

O Bloco 3 — Buyer foi formalmente encerrado como `REAL-TESTED / PASS`. `QA-BROWSER-007` e `QA-BROWSER-013` permanecem `OPEN / NON_BLOCKER`; não foram corrigidos nesta reconstrução. Multi-Seller permanece `COBERTURA AUTOMATIZADA / ESTRUTURAL` com `LIMITAÇÃO DE FIXTURE`, sem inventar evidência Browser.

Disputa completa, refund/reversal, chargeback, reposição após Buyer-win, fechamento de chat pós-disputa, bloqueio server-side de review, PSP real, payout, saque, scheduler produtivo ainda pendente e revisão humana sênior não são concluídos por este fechamento. Seller e Admin também não estão encerrados.

Antes de outro bloco: verificar evidência histórica, verificar mudança no código relevante e repetir browser somente por necessidade objetiva; não refazer arbitrariamente prova `REAL-TESTED` válida.
