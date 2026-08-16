# LIT Buy — Final Functional Audit — Bloco 3: Buyer — progresso intermediário

## Finalidade

Este documento preserva de forma detalhada o estado **intermediário** do **Bloco 3 — Buyer** da validação funcional final.

Ele foi criado antes do encerramento do bloco porque, durante a bateria Buyer, surgiu um blocker real de pagamento (`QA-BROWSER-004`) que precisou ser diagnosticado, corrigido, revalidado e mergeado antes de a auditoria poder continuar.

O objetivo é impedir que o desvio corretivo apague o ponto exato de retomada da auditoria.

Este documento complementa:

- `FINAL_FUNCTIONAL_VALIDATION_CHECKLIST.md`;
- `FINAL_FUNCTIONAL_AUDIT_REPORT.md`;
- `FINAL_FUNCTIONAL_AUDIT_REMEDIATION_GATE.md`;
- `POST_FREEZE_BROWSER_QA_FINDINGS.md`;
- `POST_FREEZE_BROWSER_QA_BUYER_ADDENDUM_2026-08-16.md`.

Ele **não**:

- declara o Bloco 3 concluído;
- autoriza Phase B;
- autoriza PSP real ou dinheiro real;
- substitui o Ledger formal de findings Claude;
- transforma observação de rehearsal local em homologação de produção;
- autoriza correção de todos os findings abertos antes de terminar a auditoria por blocos.

---

# 1. Estado atual e ponto de retomada

**Status do Bloco 3:** `EM ANDAMENTO — PAGAMENTO ALPHA LOCAL DESBLOQUEADO`.

**Ponto exato de retomada:** continuar a bateria Buyer **depois** de carrinho, checkout, expiração e pagamento Alpha local terem sido exercitados e depois de `QA-BROWSER-004` ter sido corrigido/mergeado.

A correção da PR #87 foi um desvio controlado por blocker. Ela **não inicia uma fase geral de remediação**.

Próxima regra operacional:

> retornar ao restante do Bloco 3 — Buyer, terminar o bloco, documentar/classificar tudo e só então avançar ao bloco seguinte.

---

# 2. Baseline remoto e ambiente

## 2.1 GitHub remoto

Repositório autoritativo:

`00luansp00/litbuy-hub`

Após o merge corretivo do pagamento:

- PR #87: `fix(payments): make FAKE_ALPHA external ids restart-safe`;
- head validado da PR: `33bcddedcd9cd2fae0a747ebac959d11c97bc7f8`;
- merge commit em `main`: `877c8c07246b9acae94fbc33bc568363df2c724b`;
- `main` remoto confirmado nesse SHA após o merge.

GitHub remoto continua sendo a fonte de verdade caso qualquer workspace local ou checkpoint diverja.

## 2.2 Workspace Browser QA

Workspace usado:

`C:\Users\luans\litbuy-browser-validation`

Durante a validação da PR #87, o workspace foi colocado em detached HEAD no commit:

`33bcddedcd9cd2fae0a747ebac959d11c97bc7f8`

Comando usado:

```bat
git fetch origin codex/corrigir-controle-de-id-externo-no-fakepaymentprovider
git switch --detach 33bcddedcd9cd2fae0a747ebac959d11c97bc7f8
```

Antes de retomar novos testes após esta documentação/checkpoint, o workspace deve ser sincronizado novamente com o `main` remoto mergeado e confirmado limpo.

Não preservar detached HEAD antigo como nova autoridade.

## 2.3 Composição local

Compose:

`docker-compose.staging.yml`

Portas locais usadas:

- frontend: `13000`;
- backend: `13001`;
- PostgreSQL: `15432`;
- Redis: `16379`;
- MinIO: `19000`;
- MinIO console: `19001`.

A composição é rehearsal local/staging-like e usa `FAKE_ALPHA`. Não representa staging hospedado nem PSP real.

Durante a validação pós-fix da PR #87, o backend foi rebuildado isoladamente:

```bat
docker compose -f docker-compose.staging.yml build backend
docker compose -f docker-compose.staging.yml up -d --no-deps backend
docker compose -f docker-compose.staging.yml ps backend
```

O backend ficou `healthy` em `127.0.0.1:13001->3001`.

---

# 3. Blocos anteriores — referência de continuidade

Antes do Bloco Buyer:

- Bloco 1 — Público/Home/Catálogo/Produto: auditado/documentado, findings preservados;
- Bloco 2 — Auth/Sessão/Segurança da conta: auditado/documentado pela PR #86;
- `main` antes do blocker Buyer estava em `8b1af6f4dc993eb662f432a31117e2fe76852e99`.

O Bloco Buyer começou a partir desse estado e foi interrompido apenas pelo blocker de pagamento descrito abaixo.

---

# 4. Carrinho Buyer — evidência já executada

Conta Buyer demo usada:

`comprador@demo.litbuy.local`

Senha local demo:

`LitBuyDemo2026!`

## 4.1 Persistência do carrinho — `REAL-TESTED`

Foi observado carrinho real da conta persistindo em:

- `F5`;
- fechamento/retomada do navegador;
- logout/login posterior na conta adequada.

A evidência demonstra que o carrinho não é apenas estado visual efêmero do componente.

## 4.2 CRUD e totais — `REAL-TESTED`

Foram exercitados:

- aumentar quantidade;
- diminuir quantidade;
- recálculo dos totais;
- persistência após refresh;
- remover item;
- remover o último item;
- empty state após esvaziamento;
- persistência do empty state.

## 4.3 Adição limpa de produto real — `REAL-TESTED`

Produto usado em uma das rodadas:

`/produto/demo-licenca-digital`

Variante selecionada:

`Mensal`

Preço observado nessa rodada:

R$ 29,90.

## 4.4 Duplicidade da mesma variante — `REAL-TESTED`

Após adicionar produto + variante já presente:

- a UI passou a indicar `Já está no carrinho`;
- tentativa backend equivalente foi protegida por `CART_ITEM_ALREADY_EXISTS` / HTTP 409;
- a proteção de unicidade não foi contornada.

Uma variante diferente do mesmo produto continua sendo entidade de compra distinta quando o contrato permite.

## 4.5 Boundary de estoque — `REAL-TESTED`

Para a variante Mensal, com estoque observado de 50:

- quantidade 50 foi aceita;
- tentativa de aumentar para 51 retornou insuficiência de estoque;
- estado permaneceu em 50;
- `F5` preservou a quantidade válida;
- depois a quantidade foi reduzida novamente para continuidade da bateria.

## 4.6 Itens ainda não encerrados do carrinho

Ainda não considerar concluído sem classificar/testar quando aplicável:

- isolamento explícito Buyer A vs Buyer B;
- carrinho envolvendo múltiplos Sellers — a seed atual possui somente um Seller demo; não inventar um segundo apenas para forçar o cenário sem decidir método controlado;
- replay/idempotência de mutations do carrinho além das evidências técnicas já existentes.

---

# 5. Auth redirect observado dentro do Buyer

O finding `QA-BROWSER-007` foi ampliado por nova evidência.

Além do fluxo público:

`Produto → Login → Home`

também foi observado:

`/carrinho` deslogado → login → Home

em vez de retornar ao carrinho/intenção original.

Portanto o problema é mais amplo que apenas `PublicProductPurchasePanel`: a autenticação atual não preserva genericamente a intenção/destino protegido que motivou o login.

Não corrigir durante o restante do bloco se continuar `NON_BLOCKER`; preservar para triagem/remediação.

Uma eventual correção deve evitar auto-add silencioso e replay de mutation.

---

# 6. Checkout — evidência já executada

Checkout exercitado:

`/checkout?sellerSlug=demo-lit-store`

## 6.1 Revisão pré-pedido — `REAL-TESTED`

A revisão mostrou de forma coerente:

- Seller;
- produto;
- variante;
- quantidade;
- preços;
- estado pronto para checkout.

Nenhuma cobrança é criada apenas por visualizar a revisão.

## 6.2 Proteções técnicas confirmadas

A implementação envia/valida:

- versão atual do carrinho;
- preview fingerprint;
- idempotency key determinística para a operação aplicável;
- guards server-side de mismatch.

A existência técnica desses guards não substitui todos os cenários negativos manuais ainda pendentes.

## 6.3 Pedido de prova inicial

Foi criado o pedido:

`LIT-XDBTWRNE9CJ6KX`

Valor inicial da rodada:

R$ 29,90.

Após criação:

- `Order.status = PENDING_PAYMENT`;
- pagamento ainda não criado;
- fulfillment indisponível;
- dispute `NONE`;
- snapshots históricos preservados;
- expiração configurada em 15 minutos;
- `F5` não recriou pedido;
- carrinho foi consumido/esvaziado.

Classificação:

- criação server-authoritative do pedido: `REAL-TESTED`;
- snapshot persistente: `REAL-TESTED`;
- consumo do carrinho: `REAL-TESTED`.

---

# 7. Expiração de pedido antes do pagamento

O pedido `LIT-XDBTWRNE9CJ6KX` expirou antes da tentativa de pagamento.

## 7.1 Guard de domínio no backend — `REAL-TESTED`

Ao tentar iniciar pagamento após o deadline, a UI mostrou:

`PEDIDO NÃO ELEGÍVEL PARA PAGAMENTO`

A análise confirmou que `payment-orchestration.service.ts` rejeita pedido expirado por tempo antes de criar `Payment`/`PaymentAttempt`.

**Conclusão:** o domínio server-side impede pagamento de pedido cujo `expiresAt <= now` mesmo quando o estado persistido ainda não foi materializado como `EXPIRED`.

## 7.2 Finding `QA-BROWSER-013`

Foi observado que, antes de o processador de expiração materializar o estado:

- a UI ainda podia apresentar pedido como visualmente ativo;
- o botão de pagamento ainda podia aparecer;
- somente a tentativa backend revelava que o pedido já não era elegível.

Classificação intermediária:

- `QA-BROWSER-013`;
- `OPEN`;
- `NON_BLOCKER` no rehearsal local;
- importante para produção/UX porque ação visualmente disponível não deve depender de erro posterior para comunicar deadline já vencido.

Critério futuro: reconciliar tempo atual/estado persistido e/ou garantir execução operacional suficiente da rotina de expiração para não manter ação enganosa.

## 7.3 Rotina de expiração real — `REAL-TESTED` quando invocada

Foi identificado:

`backend/src/orders/order-expiration.service.ts`

A rotina:

- busca pedidos `PENDING_PAYMENT` vencidos e não pagos;
- trava/revalida;
- marca `EXPIRED` e `expiredAt`;
- incrementa versão;
- libera reservas `ACTIVE` como `EXPIRED` com `releasedAt`/reason;
- cria eventos `ORDER_EXPIRED` / `INVENTORY_RELEASED` e outbox;
- registra evento de segurança aplicável.

## 7.4 Comando operacional correto dentro da imagem runtime

O `package.json` possui script TypeScript equivalente a:

`orders:expire -> ts-node src/orders/order-expiration.cli.ts`

Porém a imagem runtime do backend contém `/dist` e não `/src`. Portanto, dentro do container runtime, o script baseado em `src` falhou por módulo ausente.

O comando que funcionou no rehearsal foi:

```bat
docker compose -f docker-compose.staging.yml exec backend node dist/orders/order-expiration.cli.js
```

Saída observada na rodada:

```json
{"examined":3,"expired":3}
```

Após `F5` do pedido de prova:

- UI mostrou `Pedido expirado`;
- `expiredAt` persistido;
- pagamento continuou não criado;
- fulfillment indisponível;
- dispute `NONE`;
- snapshots históricos preservados;
- botão de pagamento desapareceu.

## 7.5 Limite operacional importante

No rehearsal local auditado não foi identificado executor automático ativo por default para a expiração.

Não inferir worker/cron/scheduler de produção que não foi comprovado.

A existência da service/CLI prova capacidade de processamento, não homologação de execução automática produtiva.

## 7.6 Prisma/OpenSSL

O warning conhecido do Prisma/OpenSSL apareceu também nessa operação sem impedir a conclusão.

Continua sendo item de hardening/runtime posterior; não foi tratado oportunisticamente durante o Buyer.

---

# 8. QA-BROWSER-004 — reprodução limpa do blocker de pagamento

Depois de limpar o cenário de expiração, foi criado um pedido novo e a ação foi executada **uma única vez**, sem refresh/replay contaminante.

Pedido de reprodução limpa:

`LIT-XUNGUU93ADSY33`

Antes do clique:

- `PENDING_PAYMENT`;
- pagamento `NOT_CREATED`;
- tentativa não iniciada;
- botão `Iniciar pagamento Alpha` disponível.

Após um único clique:

`RECONCILIAÇÃO DE PAGAMENTO NECESSÁRIA`

Isso transformou `QA-BROWSER-004` de cenário contaminado/hipótese em **blocker atual reproduzido de forma limpa**.

---

# 9. Evidência de banco da reprodução limpa

Consulta read-only mostrou para `LIT-XUNGUU93ADSY33`:

- order `PENDING_PAYMENT`;
- order payment status `PENDING`;
- payment `PENDING`;
- attempt #1 `PENDING`;
- provider `FAKE_ALPHA`;
- `externalPaymentId = null`;
- `providerStatusRaw = null`;
- `ReconciliationIssue.status = OPEN`;
- `ReconciliationIssue.type = OTHER`;
- details contendo reason:

`PROVIDER_SUCCEEDED_LOCAL_PERSISTENCE_FAILED`

Nenhuma tentativa de remover/relaxar a constraint foi autorizada.

---

# 10. Causa-raiz do QA-BROWSER-004

Histórico de attempts `FAKE_ALPHA` mostrou IDs antigos persistidos como:

- `fake_payment_1`;
- `fake_payment_2`.

O `FakePaymentProvider` usava contador em memória:

```ts
private sequence = 0;
```

E criava:

```ts
id: `fake_payment_${++this.sequence}`
```

Após restart do backend, o provider era recriado e o contador voltava a zero.

O PostgreSQL, corretamente, preservava os `externalPaymentId` históricos.

A migration possui constraint/índice único sobre:

`(providerCode, externalPaymentId)`

Assim, um novo `fake_payment_1` após restart colidia com o histórico.

**Interpretação correta:**

- a constraint estava funcionando;
- a reconciliação fail-safe estava funcionando;
- o defeito era o provider fake/local usar contador volátil como fonte de unicidade global.

Efeito positivo do fail-safe:

- nenhum pagamento histórico foi sobrescrito;
- o pedido não foi falsamente marcado como pago;
- a inconsistência foi encaminhada para reconciliação.

---

# 11. Decisão corretiva aprovada

Correção restrita ao provider fake/local:

- remover contador em memória como fonte do ID externo;
- derivar deterministicamente o ID de pagamento fake a partir de `idempotencyHash`;
- usar SHA-256;
- formato:

`fake_payment_<sha256(idempotencyHash)>`

A correção **não** deveria alterar:

- schema Prisma;
- migrations;
- unique constraints;
- Ledger;
- `SaleFinancialRecognition`;
- state machine de `Payment`;
- state machine de `Order`;
- reconciliação;
- PSP real;
- worker/cron de produção;
- frontend;
- Phase B;
- dados históricos/reconciliation issue do pedido de evidência.

---

# 12. PR #87 — implementação final

PR:

`#87 — fix(payments): make FAKE_ALPHA external ids restart-safe`

Commit correto da correção:

`33bcddedcd9cd2fae0a747ebac959d11c97bc7f8`

Arquivos finais:

- `backend/src/financial/fake-payment-provider.ts`;
- `backend/src/financial/fake-payment-provider.spec.ts`.

Diff final:

- 54 adições;
- 2 remoções;
- somente 2 arquivos.

Implementação funcional:

```ts
id: `fake_payment_${createHash('sha256').update(input.idempotencyHash).digest('hex')}`
```

O mapa `payments` e o mapa `keyed` foram preservados.

## 12.1 Testes da implementação

Antes da publicação final foram observados:

- teste focado do provider: 1 suíte / 4 testes passando;
- `typecheck` sem erro;
- eslint focado sem erro;
- prettier check sem erro;
- suíte backend completa: 46 suítes / 610 testes passando;
- `git diff --check` sem erro.

Cobertura focada adicionada:

1. mesma instância + mesma `idempotencyHash` → mesmo payment;
2. instâncias diferentes simulando restart + mesma hash → mesmo ID;
3. operações diferentes após restart → IDs diferentes;
4. `simulate` + `getPayment` continuam funcionando.

## 12.2 Histórico de CI da PR e incidente de branch

A PR teve um evento operacional que precisa ser preservado para evitar leitura errada do histórico de Actions:

- commit correto `33bcdded...` executou CI #330 com sucesso;
- posteriormente entrou um segundo commit remoto acidental que também removeu `private readonly payments = new Map<...>()`;
- esse segundo commit causou falhas de lint/integration no CI #331 porque métodos ainda usavam `this.payments`;
- essa remoção extra **não fazia parte da correção aprovada**;
- com autorização explícita do owner, a branch da PR foi resetada de volta para `33bcdded...`;
- o diff voltou a 54 adições / 2 remoções;
- CI #332 passou com sucesso;
- a PR foi então mergeada pelo owner.

Esse CI vermelho intermediário não é evidência de falha da solução final mergeada; corresponde ao commit extra removido antes do merge.

## 12.3 Merge final

Merge commit:

`877c8c07246b9acae94fbc33bc568363df2c724b`

Nenhum auto-merge foi usado no fluxo controlado desta validação.

---

# 13. Browser regression da PR #87

Após rebuild do backend corrigido, foram usados **pedidos novos**, sem reaproveitar `LIT-XUNGUU93ADSY33`, que permanece evidência histórica do blocker.

## 13.1 Pedido `LIT-DRJB56BEU7TWVN`

Após `Iniciar pagamento Alpha` uma única vez:

- pedido permaneceu `PENDING_PAYMENT`;
- tentativa `PENDING (#1)`;
- botão `Simular aprovação Alpha` apareceu;
- **não** apareceu reconciliação necessária.

Após `F5`:

- pedido continuou `PENDING_PAYMENT`;
- pagamento `PENDING`;
- tentativa continuou `PENDING (#1)`;
- não foi criada tentativa #2;
- não houve reconciliação.

Isso fornece evidência manual direta de que o restart-safe external ID eliminou o blocker reproduzido.

## 13.2 Observação visual transitória

No primeiro render imediatamente após a mutation, uma tela chegou a mostrar `Não criado` ao mesmo tempo em que já existia tentativa `PENDING (#1)`.

Após `F5`, o payment status apareceu como `PENDING` coerente.

Essa observação não bloqueou o fluxo e não foi transformada automaticamente em novo finding separado durante o desvio corretivo. Ela deve ser considerada junto da análise de stale state/`QA-BROWSER-003` no fechamento do Buyer.

---

# 14. Aprovação Alpha e QA-BROWSER-003

Um segundo pedido novo foi usado porque o operador quis confirmar o fluxo novamente:

`LIT-5TA2XY8Y3U8ARK`

Após `Simular aprovação Alpha` uma única vez, **antes de F5** a UI mostrou:

- `Order.status = ACTIVE`;
- `Payment = PAID`;
- `Attempt = SUCCEEDED (#1)`;
- mensagem de que o pedido não aceitava nova tentativa.

Depois de `F5`, o mesmo estado permaneceu.

## 14.1 Estado intermediário do QA-BROWSER-003

O comportamento histórico de tela stale após aprovação Alpha **não se reproduziu** nessa nova rodada limpa.

Entretanto:

- a PR #87 não alterou frontend/cache;
- não houve uma correção específica aprovada para `QA-BROWSER-003`;
- existiu a observação transitória `Não criado` antes do F5 na etapa de payment pending.

Portanto, neste ponto intermediário, não declarar `QA-BROWSER-003` como “corrigido pela PR #87”.

Disposição conservadora até o fechamento do bloco:

- evidência histórica real preservada;
- nova rodada sem reprodução após aprovação;
- reavaliar/classificar ao fechar o Buyer e na revalidação consolidada.

---

# 15. Banco pós-fix — externalPaymentId e reconciliação

Consulta read-only do pedido `LIT-5TA2XY8Y3U8ARK` confirmou:

- `order_status = ACTIVE`;
- `order_payment_status = PAID`;
- `payment_status = PAID`;
- `attemptNumber = 1`;
- `attempt_status = SUCCEEDED`;
- `providerCode = FAKE_ALPHA`;
- `externalPaymentId = fake_payment_ae4a116776b33e677e12f00df490ec00b028a09c10dd8479bdf7fd4e6b3602c8`;
- nenhuma reconciliation status/type vinculada ao attempt.

O formato comprova que o ID usado na operação real do rehearsal corresponde ao esquema determinístico novo e não a `fake_payment_1/2`.

---

# 16. Invariantes financeiros pós-pagamento

No mesmo pedido `LIT-5TA2XY8Y3U8ARK`, consulta read-only confirmou:

`SALE_RECOGNIZED count = 1`

Ledger:

- `SALE_RECOGNIZED / OrderSale / BRL`;
- `SYSTEM / PROVIDER_CLEARING / DEBIT = 10000`;
- `SELLER / SELLER_PENDING / CREDIT = 10000`.

Portanto:

- débito total = 10000;
- crédito total = 10000;
- exatamente um reconhecimento de venda;
- nenhuma reconciliação financeira `OPEN` de `SaleFinancialRecognition` para o pedido.

## 16.1 Comissão nessa prova

Não houve linha `PLATFORM_COMMISSION` nessa consulta específica.

Isso **não foi classificado como bug desta PR**.

A PR #87 não altera fee policy, checkout snapshot, Ledger ou reconhecimento financeiro.

A ausência de comissão precisa ser interpretada dentro da política ativa/snapshot do pedido se esse comportamento for auditado posteriormente; não ampliar o escopo do blocker de external ID para comissão sem evidência própria.

---

# 17. Classificação atual do QA-BROWSER-004

Após a PR #87:

**Estado:** `CLOSED` para o rehearsal Alpha local.

Evidências necessárias já presentes:

- reprodução limpa do bug;
- causa-raiz confirmada;
- correção mínima;
- testes focados;
- suíte backend completa;
- CI verde #330 e #332 no commit correto;
- browser com pedido novo;
- refresh sem tentativa duplicada;
- aprovação Alpha;
- refresh pós-aprovação;
- ID externo determinístico persistido;
- nenhuma reconciliação de payment attempt;
- `SALE_RECOGNIZED = 1`;
- Ledger balanceado;
- nenhuma reconciliação financeira aberta;
- merge da PR #87.

Limite da classificação:

- fecha o defeito do **provider fake/local**;
- não prova PSP real;
- não fecha staging hospedado;
- não fecha PASS2-F1 produtivo;
- não cria worker/cron/scheduler de produção;
- não representa homologação de dinheiro real.

---

# 18. Regra anti-loop aplicada durante esta correção

Este caso passa a servir de referência operacional.

A auditoria encontrou blocker no meio do Buyer. O trabalho permitido foi:

1. parar o teste;
2. reproduzir de forma limpa;
3. diagnosticar causa-raiz;
4. delimitar uma mudança mínima;
5. evitar tocar constraints/Ledger/state machines;
6. executar testes focados e regressão ampla;
7. revisar diff;
8. corrigir um incidente de branch sem inventar uma nova solução;
9. validar no browser e banco;
10. mergear somente após evidência suficiente;
11. **retornar ao Buyer**.

Não começar agora a corrigir todos os findings `NON_BLOCKER` encontrados nos blocos anteriores.

---

# 19. Itens Buyer ainda pendentes

O Bloco 3 **não está encerrado**.

A retomada deve revisar e executar, quando aplicável, pelo menos:

- `/pedidos` — lista Buyer real e persistência após `F5`;
- detalhe do pedido Buyer;
- ownership/isolation entre Buyers para leitura de pedidos;
- código inexistente/outro Buyer retornando boundary segura;
- replay/idempotência de payment mutation após o fluxo limpo, sem contaminar pedido histórico;
- cenários negativos de checkout stale preview/version/fingerprint conforme checklist e evidência técnica disponível;
- isolamento de carrinho entre Buyers;
- múltiplos Sellers no carrinho/checkout — classificar corretamente se a seed atual não permite prova manual sem preparação controlada;
- pós-compra Buyer que pertença ao escopo deste bloco;
- distinguir o que deve ficar para Bloco Seller/Fulfillment em vez de duplicar teste;
- reavaliar `QA-BROWSER-003` com a evidência nova;
- consolidar `QA-BROWSER-013`;
- consolidar a expansão de `QA-BROWSER-007`;
- registrar qualquer novo finding sem iniciar remediação geral se não for blocker.

O histórico BROWSER-A5 já provou um fluxo Buyer → pagamento → Seller entrega → Buyer confirma, mas a auditoria final continua por blocos e não deve usar esse histórico para pular arbitrariamente gates ainda previstos.

---

# 20. O que não deve ser feito na retomada

Até decisão explícita posterior:

- não iniciar Phase B;
- não integrar PSP real;
- não criar worker/cron produtivo por inferência;
- não implementar saque/payout/KYC real;
- não alterar Ledger ou fee policy sem finding próprio e escopo aprovado;
- não corrigir `QA-BROWSER-001/002/005/006/007/008/009/010/011/012/013` em massa durante o Bloco Buyer;
- não reabrir chat, Home, busca real, reviews, favoritos, storefront, promoções ou outras capabilities futuras apenas porque foram observadas;
- não repetir a correção do `QA-BROWSER-004` já mergeada;
- não reutilizar pedidos contaminados como prova limpa de uma nova regressão;
- não apagar `ReconciliationIssue` histórico apenas para “limpar” a base de evidência.

---

# 21. Ponto operacional para o próximo chat/sessão

Antes de retomar a bateria:

1. consultar GitHub remoto;
2. confirmar `main` atual e PRs abertas;
3. confirmar que PR #87 permanece mergeada;
4. no workspace `C:\Users\luans\litbuy-browser-validation`, sair do detached HEAD antigo e sincronizar com `origin/main` de forma limpa;
5. confirmar serviços `healthy` e `demo:check` quando necessário;
6. não resetar a base demo automaticamente se a persistência histórica ainda for útil;
7. continuar **o restante do Bloco 3 — Buyer**.

Se o remoto divergir deste documento, o remoto prevalece.

---

# 22. Documentação a reconciliar no fechamento do Bloco 3

Quando o Buyer estiver realmente encerrado, executar atualização documental controlada para:

- consolidar o bloco em documento final do Buyer/`FINAL_FUNCTIONAL_AUDIT_REPORT.md` conforme padrão vigente;
- reconciliar `POST_FREEZE_BROWSER_QA_FINDINGS.md` com os estados definitivos;
- incorporar as informações temporárias do addendum Buyer ao ledger principal;
- registrar `QA-BROWSER-004` como fechado com PR #87/evidências;
- registrar disposição final de `QA-BROWSER-003`;
- registrar `QA-BROWSER-013`;
- expandir `QA-BROWSER-007` para o redirect genérico de intenção;
- preservar nota operacional da expiração runtime/CLI;
- manter a regra anti-loop no remediation gate;
- atualizar checklist/process status se o fechamento do bloco mudar o estado global.

Somente depois dessa documentação/revisão deve começar o próximo bloco funcional.
