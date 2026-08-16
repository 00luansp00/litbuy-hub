# LIT Buy — Addendum de evidências de remediação pós-auditoria — 2026-08-16

## Finalidade

Este documento preserva e reconcilia evidências objetivas de remediações executadas **depois** do `AUDIT BASELINE` imutável `b88e6efdc252dc9eb6afd3d90375dc3d454ce72d` e antes do próximo checkpoint mestre.

Ele foi criado porque `CLAUDE_AUDIT_FINDINGS_LEDGER.md` nasceu no corte pós-auditoria com todos os findings `OPEN` e campos de evidência `N/A — no remediation yet`, mas algumas remediações posteriores já foram implementadas, testadas, mergeadas e revalidadas sem que as linhas formais do Ledger tenham sido reescritas ainda.

Este addendum existe para impedir que o histórico real de correções desapareça ou seja interpretado incorretamente no próximo chat/handoff.

## Autoridade e limite

- `CLAUDE_AUDIT_FINDINGS_LEDGER.md` continua sendo a maior autoridade formal para status final dos findings Claude.
- Este addendum **não altera silenciosamente o status formal das linhas do Ledger**.
- Quando a linha do Ledger ainda disser `OPEN`, ela continua formalmente `OPEN` até uma atualização controlada do próprio Ledger.
- Este addendum registra qual remediação já existe e qual disposição deve ser considerada na futura reconciliação formal.
- GitHub remoto continua sendo a fonte de verdade para PR, SHA, diff, CI e merge.
- O addendum não autoriza Phase B, PSP real, dinheiro real, payout, saque, KYC produtivo, scheduler/worker produtivo ou outras ampliações de escopo.

---

# 1. Estado remoto no corte deste addendum

Repositório:

`00luansp00/litbuy-hub`

`main` remoto confirmado antes deste addendum:

`aa639fec4cfdd7e5e204e4e97771f2ed85ce2f63`

Esse SHA corresponde ao merge da PR #88:

`docs(audit): persist Buyer progress and correction governance`

No corte:

- PR #87 já estava mergeada;
- PR #88 já estava mergeada;
- não havia PR aberta antes da criação desta branch documental;
- feature freeze continua ativo;
- auditoria funcional final continua no Bloco 3 — Buyer;
- produção e dinheiro real continuam bloqueados.

---

# 2. P3-F1 — cookie CSRF não alcançava mutations normais do SPA

## 2.1 Finding original

ID formal:

`P3-F1`

Severidade final da auditoria:

`HIGH`

Título no Ledger:

`Cookie litbuy_csrf com Path=/api/v1/auth fica indisponível às mutações normais do SPA.`

Causa final da auditoria:

- path matching de cookie;
- cookies não são isolados por porta;
- o cookie CSRF em `/api/v1/auth` não era enviado para mutations como `/api/v1/carts/...`, checkout, orders e seller APIs;
- o problema era principalmente funcional/fail-closed e de defesa CSRF não exercitada nessas mutations, não um bypass atacante comprovado.

A decisão registrada antes do patch era não remover CSRF e produzir threat model/contrato explícito antes da correção.

## 2.2 Remediação implementada — PR #74

PR:

`#74 — Separate CSRF/refresh/device cookie paths, clear legacy CSRF, and add tests`

Head final:

`196275924b7e5fe7ef0c9194645196c612600db6`

Merge commit:

`4a4bc1c0f50c5d8624c751472ca2ae3dd34f9c58`

CI do head correto:

`#299 — success`

Mudança principal:

- criado `CSRF_SESSION_THREAT_MODEL.md`;
- cookie CSRF passou a usar path raiz apropriado para o double-submit do SPA;
- refresh/device cookies mantiveram boundaries próprias e `HttpOnly` quando aplicável;
- refresh passou a rotacionar o cookie CSRF raiz;
- cookie CSRF legacy em `/api/v1/auth` passou a ser limpo para evitar ambiguidade entre paths;
- logout e device cookie receberam semântica/path explícitos;
- nenhuma remoção da proteção CSRF foi feita.

Testes adicionados/expandidos:

- frontend `__tests__/api-client.test.ts`;
- backend `backend/src/carts/cart-csrf.guard.spec.ts`;
- backend e2e `backend/test/auth.e2e-spec.ts`;
- assertions de `Path`, `HttpOnly`, `SameSite`, rotação, legacy clear e logout semantics.

## 2.3 Evidência funcional posterior

Depois da PR #74, Browser QA posterior conseguiu executar mutations reais protegidas do caminho crítico, incluindo:

- carrinho Buyer: add/update/remove;
- checkout real;
- payment attempts Alpha;
- confirmação de recebimento Buyer;
- entrega Seller;
- operações Auth/segurança exercitadas no Bloco 2.

Essas evidências não substituem os testes específicos da PR, mas demonstram que a boundary corrigida permaneceu funcional nas rodadas posteriores.

## 2.4 Relação com P3-F10

`P3-F10` tratava a cobertura CSRF/sessão inconsistente e a ausência de threat model formal.

A PR #74 criou `CSRF_SESSION_THREAT_MODEL.md`, portanto **parte material do gap documental foi atendida**.

Entretanto a própria PR #74 preservou explicitamente o escopo mais amplo de `P3-F10` como aberto. Não usar a correção de `P3-F1` para fechar automaticamente toda a política/hardening de sessão/CSRF de produção.

## 2.5 Disposição para futura atualização formal do Ledger

Evidência existente sustenta tratar `P3-F1` como **candidato a `FIXED`**, sujeito à atualização formal da linha do Ledger com:

- Fix PR #74;
- head `196275...`;
- merge `4a4bc1...`;
- CI #299;
- testes específicos;
- Browser QA posterior;
- residual scope deixando `P3-F10`/hardening amplo separado.

Até essa reescrita formal, a linha original do Ledger ainda pode aparecer `OPEN`; isso é **dívida de reconciliação documental**, não ausência da correção de código.

---

# 3. PASS2-F5 — fulfillment pago sem caller para AWAITING_SELLER

## 3.1 Finding original

ID formal:

`PASS2-F5`

Severidade final:

`HIGH`

Título no Ledger:

```
NOT_AVAILABLE → AWAITING_SELLER não tem caller de runtime nem CLI.
```

A auditoria proibiu a solução oportunista de simplesmente chamar `makeAvailable()` em um ponto arbitrário. O ponto correto de orquestração precisava ser definido antes do patch.

## 3.2 Remediação inicial — PR #75

PR:

`#75 — fix(orders): orchestrate paid fulfillment availability`

Head final:

`8b55fb56f26c9e30ab1df84ca7d700a4972ed3dc`

Merge commit:

`1675de92746ad35086e762e72c9fd57fc079007b`

CI:

`#301 — success`

A PR introduziu uma capability estreita de orquestração pós-pagamento:

- `PaidOrderAvailabilityOrchestrator`;
- activation autoritativa;
- releitura do `Order`;
- progressão para availability somente em estado elegível;
- chamada centralizada a `OrderFulfillmentService.makeAvailable(...)`;
- fail-closed quando há `ReconciliationIssue` ativa de fulfillment;
- CLI on-demand de recovery/batch;
- nenhuma criação de daemon/worker/cron produtivo.

A mutation Alpha passou a usar o orquestrador em vez de espalhar activation/availability.

## 3.3 Evolução posterior necessária — PR #81

Durante Browser QA, foi identificado `BROWSER-A5`: o pedido podia ser disponibilizado ao Seller antes de o `SALE_RECOGNIZED` existir.

Isso não anulou a decisão de ter um caller de availability; mostrou que a ordem de orquestração precisava respeitar o reconhecimento financeiro antes de expor a venda ao Seller.

PR corretiva:

`#81 — fix(financial): orchestrate alpha sale recognition before availability`

Head validado:

`20db7aea9dd2a3df0475a1c281cadc8608e88479`

Merge:

`3f8d7fb75a2192d08d0bc3e005c4fa4ebce227a4`

A solução final local Alpha compõe, de forma estreita:

`activation → estado ACTIVE+PAID → SALE_RECOGNIZED → validação autoritativa → makeAvailable → AWAITING_SELLER`

Sem alterar `OrderFulfillmentService.completeLocked()` e sem criar runtime automático de produção.

## 3.4 Regressão manual BROWSER-A5

Pedido de prova:

`LIT-SELPYT2KNHNTYH`

Valor:

`4990` minor units / R$ 49,90.

Antes de Seller entregar:

- `Order = ACTIVE`;
- `Payment = PAID`;
- `Fulfillment = AWAITING_SELLER`;
- `Dispute = NONE`;
- exatamente `1 SALE_RECOGNIZED`;
- `PROVIDER_CLEARING DEBIT = 4990`;
- `SELLER_PENDING CREDIT = 4990`;
- nenhum `SELLER_HELD` ou `SELLER_AVAILABLE` prematuro;
- nenhuma reconciliação ativa do reconhecimento.

Após Seller entregar:

- `AWAITING_BUYER_CONFIRMATION`;
- reconhecimento continuou único;
- financeiro não se moveu prematuramente.

Após Buyer confirmar:

- `COMPLETED / PAID / CONFIRMED / NONE`;
- `SALE_RECOGNIZED = 1`;
- nenhuma reconciliação ativa.

## 3.5 Residual obrigatório: PASS2-F1

A correção local/rehearsal de availability **não fecha `PASS2-F1`**.

`PASS2-F1` continua sendo o gap amplo de runtime/orchestration automática de produção.

Não inventar cron/worker/scheduler de produção como consequência de PASS2-F5.

## 3.6 Disposição para futura atualização formal do Ledger

O defeito específico de `PASS2-F5` possui evidência forte para ser tratado como **candidato a `FIXED` no escopo local/Alpha implementado**, com:

- PR #75 / head / merge / CI #301;
- evolução de ordem correta na PR #81;
- Browser A5 completo;
- ausência de regressão financeira;
- residual explícito em `PASS2-F1` para runtime produtivo.

Até atualização da linha formal, o Ledger ainda pode exibir `PASS2-F5 = OPEN` por dívida documental.

---

# 4. P4-F2 — readiness sem provider e payment mode local

## 4.1 Finding original

ID formal:

`P4-F2`

Severidade:

`HIGH`

Título:

`Serviço pode estar ready sem payment provider; templates não definem payment mode.`

O Ledger já dividia o finding em dois escopos:

- **local Alpha/rehearsal**: precisava de wiring explícito;
- **produção/PSP**: decisão/homologação humana obrigatória.

O próprio Ledger registra que corrigir a parte local **não fecha o finding inteiro**.

## 4.2 Remediação da parte local — PR #76

PR:

`#76 — fix(alpha): wire FAKE_ALPHA into local rehearsal`

Head final:

`8603102536b12c571e0cca383cda33c9ce6f5ba3`

Merge:

`3f379693a35c7ad4997377b5fce7a1b2d463af0c`

CI:

`#304 — success`

Mudanças:

- `backend/.env.staging.local.example` passou a definir explicitamente `PAYMENT_PROVIDER_MODE=FAKE_ALPHA`;
- comentários deixam claro que o modo é somente local, proibido em production e não autoriza dinheiro real;
- teste estrutural valida que Compose usa o template correto para `migrate`, `backend` e `demo-data`;
- testes de config Alpha cobrem `development`, `test` e fail-closed em `production`;
- runbook passou a declarar explicitamente o modo `FAKE_ALPHA` da composição local.

## 4.3 Evidência posterior

Após Docker/WSL estar disponível na máquina do owner, o rehearsal real foi executado com a composição local.

Browser QA posterior confirmou operações `FAKE_ALPHA` reais do ambiente local, incluindo BROWSER-A5 e os testes Buyer do Bloco 3.

Portanto a parte **local rehearsal blocker** foi efetivamente removida.

## 4.4 Residual de produção

P4-F2 **deve permanecer formalmente `OPEN`** enquanto o escopo de produção permanecer sem decisão/homologação humana de provider/runtime/secrets/readiness.

Não usar a existência de `FAKE_ALPHA` para alegar:

- PSP produtivo homologado;
- provider real configurado;
- dinheiro real habilitado;
- readiness de produção resolvida.

## 4.5 Disposição futura do Ledger

Na futura reconciliação da linha P4-F2, registrar:

- evidência da PR #76 para remover o blocker local;
- local rehearsal = remediado;
- produção / real-money = continua blocker/humano;
- status formal geral pode permanecer `OPEN` enquanto o finding agregado possuir residual produtivo.

---

# 5. Correções de Browser QA posteriores que não devem ser confundidas com findings Claude

Entre as remediações formais e a auditoria funcional final ocorreram correções objetivas adicionais. Elas precisam constar no checkpoint, mas não devem ser forçadas em IDs Claude que não as representam.

## PR #77 — BROWSER-A1 / runtime frontend do rehearsal

Merge:

`ca3ed5d771c801516af1ad958631faf9e9d84777`

Corrigiu a imagem frontend do rehearsal, que servia a página padrão do Nginx em vez do runtime TanStack Start/Nitro.

Preservou SSR/TanStack Start e adicionou smoke que rejeita `Welcome to nginx!`.

## PR #78 — BROWSER-A2 / FeePolicy demo determinística

Merge:

`10a6e2605a820ebd30911a867448001cc352bb38`

Seed local passou a criar/reusar uma policy demo explícita, imutável e ativa com `PLATFORM_COMMISSION = 0`, evitando `FEE_POLICY_NOT_FOUND` no rehearsal.

Essa zero commission é deliberada para a base demo e não redefine política comercial futura.

## PR #79 — detalhe de pedido Buyer

Merge:

`fff7a9f3d6d6451ee3f070bf4ad764ab6f0a3546`

Corrigiu composição TanStack Router de `/pedidos/$id`, transformando a lista em index route para que o detalhe realmente renderize.

## PR #80 — detalhe de venda Seller

Merge:

`f1022e8ceb74ddb861419fed1537d9f30cbaa57b`

Aplicou a mesma correção estrutural ao fluxo `/vendedor/vendas/$id`.

## PR #81 — BROWSER-A5 / reconhecimento antes de availability

Merge:

`3f8d7fb75a2192d08d0bc3e005c4fa4ebce227a4`

Já descrita em PASS2-F5 por ser evidência posterior relevante da ordem correta de progressão local Alpha.

## PRs #82–#86

São majoritariamente documentação e governança da validação final:

- #82: Browser QA findings persistentes;
- #83: checklist de validação funcional final;
- #84: encerramento documental Bloco 1 Público;
- #85: remediation gate;
- #86: encerramento documental Bloco 2 Auth.

## PR #87 — QA-BROWSER-004

Merge:

`877c8c07246b9acae94fbc33bc568363df2c724b`

Corrigiu IDs externos do `FAKE_ALPHA` para serem restart-safe por SHA-256 da `idempotencyHash`, com Browser/DB/Ledger regression completa.

Não é finding Claude original; é finding da auditoria funcional/browser.

## PR #88 — continuidade Buyer + anti-loop

Merge:

`aa639fec4cfdd7e5e204e4e97771f2ed85ce2f63`

Persistiu o progresso intermediário do Bloco 3 e a governança anti-loop.

---

# 6. Dívida documental formal que permanece

Este addendum resolve a **perda de contexto**, mas não executa uma reescrita ampla da tabela principal do Ledger.

Antes da `Revalidação final limpa`, deve existir uma atualização controlada do `CLAUDE_AUDIT_FINDINGS_LEDGER.md` que reconcilie, pelo menos:

- `P3-F1` com PR #74 e evidências;
- `PASS2-F5` com PR #75 + evidência posterior PR #81/BROWSER-A5;
- `P4-F2` com a parte local remediada pela PR #76 e residual produtivo ainda aberto;
- eventual impacto documental parcial de PR #74 sobre `P3-F10`, sem fechá-lo automaticamente.

Não realizar essa reconciliação no meio do Bloco Buyer se ela desviar a auditoria funcional. Ela pode ser feita no gate documental/remediação consolidada antes da revalidação final.

---

# 7. Regra para o próximo checkpoint/chat

O próximo checkpoint deve distinguir explicitamente:

1. **AUDIT BASELINE**: `b88e6ef...` — imutável, snapshot realmente auditado pelo Claude;
2. **POST-AUDIT REMEDIATION HEAD**: `main` atual, que já contém correções posteriores;
3. findings formalmente `OPEN` no Ledger por falta de reconciliação documental;
4. remediações de código já existentes e comprovadas, preservadas neste addendum;
5. Browser QA findings separados dos IDs Claude;
6. residual de produção/humano que continua aberto mesmo quando o rehearsal local passou.

Nenhum checkpoint posterior pode afirmar que Claude auditou o `main` pós-remediação. Nenhuma correção local pode ser promovida a homologação de produção por inferência.
