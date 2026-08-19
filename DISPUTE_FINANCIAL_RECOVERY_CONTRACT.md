# Contrato de disputa, proteção financeira e recovery — LIT Buy

> **OWNER TARGET SUPERSEDED IN PART (2026-08-18):** `OWNER_COMMERCIAL_FINANCIAL_DECISION_FREEZE_2026-08-18.md` supersedes the target clock at `COMPLETED`, undefined default, generic 50%/rating acceleration, unresolved dispute multiplicity, top-up surplus and fee-refund points. Compatible decisions and CURRENT implementation evidence below remain preserved; the replacement is `NOT IMPLEMENTED`.

> **REFUND RECONCILIATION:** Refund / Delivery Guarantee semantics are now governed by `REFUND_DELIVERY_GUARANTEE_CONTRACT.md`. Older refund open-decision text below remains historical where superseded. Provider, chargeback and legal decisions that remain open continue open. This reconciliation does not change CURRENT findings or implementation evidence.


**Classificação:** `OWNER-AUTHORIZED TARGET CONTRACT` · `PRE-HANDOFF TARGET`
**Implementação:** `NOT IMPLEMENTED` onde indicado; este documento não prova implementação nem torna o sistema production-ready.

## 1. Autoridade e fronteiras

Este contrato congela decisões do Owner para implementação incremental futura de Dispute/Mediação, proteção financeira, liberação, recovery e a composição de um Order. O Ledger double-entry append-only continua sendo a autoridade financeira. Nenhum saldo deve ser criado ou editado como campo mutável.

**CURRENT IMPLEMENTATION:** existem Ledger append-only, buckets `SELLER_PENDING`, `SELLER_HELD`, `SELLER_AVAILABLE`, `SELLER_RESERVED` e `SELLER_DEFICIT`, `SellerFinance.deficitMinor`, `FinancialHold` de delivery protection, `releaseEligibleAt`, `SellerReleasePolicy` versionada e `Order.disputeStatus`. A policy corrente é somente global, por `DELIVERY_PROTECTION_DEFAULT`. Não existem engine persistente completa de disputa/recovery, wallet financeira sacável completa do Buyer, top-up real do Seller nem rating autoritativo capaz de antecipar liberação.

**OWNER TARGET / NOT IMPLEMENTED:** as regras abaixo não declaram backend, frontend, schema, endpoints, Admin, pagamentos, depósito, rating ou notices implementados. Nomes de campos usados em fórmulas são semânticos; schema e APIs continuam `DESIGN REQUIRED`.

## 2. “Reportar problema” é vitalício

- O label público é **“Reportar problema”**; `Dispute`/Mediação são termos de domínio.
- Não há deadline temporal automático de reporting. O Buyer pode reportar depois da entrega, confirmação, `COMPLETED`, `releaseEligibleAt` e até depois de proceeds chegarem a `SELLER_AVAILABLE`.
- A passagem do prazo financeiro não remove a ação. A elegibilidade e o ownership serão server-side.
- `REPORTING WINDOW != FINANCIAL PROTECTION WINDOW`.
- `releaseEligibleAt` **não é** `disputeDeadline` nem prazo final de reclamação.

A possibilidade de reportar é vitalícia; a proteção financeira não é. A proteção define quando proceeds podem sair de `SELLER_HELD` para `SELLER_AVAILABLE`, sempre sujeitos a bloqueios autoritativos. Múltiplos casos, máximo de um caso ativo, reabertura e novo caso após resolução permanecem `DECISION REQUIRED`.

## 3. Policy hierárquica de proteção/liberação

**CURRENT IMPLEMENTATION — GLOBAL ONLY:** `SellerReleasePolicy` resolve a regra global `DELIVERY_PROTECTION_DEFAULT`. A fundação existente de versões, publicação, `effectiveFrom`/`effectiveTo`, imutabilidade e snapshot deve ser reutilizada/evoluída.

**OWNER TARGET — HIERARCHICAL / NOT IMPLEMENTED:**

1. override de subcategoria específico e publicado;
2. senão, override de categoria específico e publicado;
3. senão, prazo padrão publicado (platform default fallback).

Em forma compacta: **SUBCATEGORY > CATEGORY > DEFAULT**. Um override pode ser menor, igual ou maior que o prazo padrão. O baseline comercial inicial definido abaixo é target de configuração futura, não fixture, hardcode ou evidência de backend implementado.

Se nenhuma regra publicada válida puder ser resolvida pela hierarquia, a execução financeira futura deve **FAIL CLOSED** (`POLICY NOT RESOLVABLE`). Nunca inventar duração silenciosamente.

O Admin futuro poderá administrar prazo padrão, overrides, ativação/desativação conforme desenho, vigências, publicação de novas versões e elegibilidade para Liberação Acelerada. Toda policy financeira será server-side, versionada, publicada, auditável, historicamente imutável, com actor/timestamp e sem edição retroativa de vendas. Painel e schema são `NOT IMPLEMENTED`.

### Owner initial commercial baseline — TARGET / NOT IMPLEMENTED

O Owner definiu o seguinte baseline comercial inicial para futuras rules publicadas:

| Grupo/categoria comercial | Prazo base | Liberação Acelerada inicialmente permitida |
| --- | ---: | :---: |
| Moedas virtuais, Gold, Ouro e Itens | 4 dias | Sim |
| Contas com e-mail não verificado | 4 dias | Não |
| Cursos, Guias, Ebooks | 4 dias | Sim |
| Vendas de contas, powerlevel e serviços | 7 dias | Não |

Os valores `4/4/4/7` são o **OWNER INITIAL COMMERCIAL BASELINE**, não hardcode definitivo. Os labels descrevem os grupos comerciais atuais, mas não podem virar enum nem autoridade por comparação textual. A implementação futura deve associar rules a IDs/relações estáveis das entidades autoritativas de categoria, subcategoria e policy version/rule. Uma mudança de nome no catálogo não invalida snapshots históricos.

Essas quatro rules não esgotam a hierarquia nem definem o fallback global. **PLATFORM DEFAULT FALLBACK VALUE: `DECISION REQUIRED / TO BE CONFIGURED`.** Nenhuma linha da tabela é promovida implicitamente a `DEFAULT`; se não houver subcategoria, categoria ou default publicado aplicável, permanece o fail-closed.

Admin deverá poder alterar durações e elegibilidade por nova versão publicada. Se um checkout congelar 4 dias e uma versão posterior mudar a rule para 7 dias, o Order anterior conserva 4 dias; somente novos Orders usam a nova versão.

## 4. Snapshot no checkout; relógio em COMPLETED

A regra aplicável será resolvida e congelada no checkout. O snapshot futuro preservará semanticamente categoria e subcategoria autoritativas, policy version/configuração, regra escolhida, source (`SUBCATEGORY`, `CATEGORY` ou `DEFAULT`), base protection delay e elegibilidade de aceleração. Nomes exatos de campos são `DESIGN TARGET`, não schema definido.

Uma alteração posterior do Admin só afeta novos checkouts. Cada Order/venda possui relógio independente; não existe relógio global do Seller.

O relógio começa apenas quando o Order fica autoritativamente `COMPLETED`:

```text
policySnapshotAt = checkout
protectionStartAt = timestamp autoritativo de COMPLETED
baseReleaseEligibleAt = protectionStartAt + frozenBaseDelay
```

PostgreSQL/backend é autoridade temporal. O frontend não calcula datas financeiras autoritativas.

## 5. Um SKU/variante por Order

**OWNER TARGET / NOT IMPLEMENTED:** um carrinho ativo tem no máximo uma linha comprável e `1 Order = 1 linha = 1 SKU/variante`. A identidade conceitual é `productId + productVariantId` quando aplicável.

- Permitido: a mesma linha com quantidade `1`, `2` ou `N`, quando o modelo permitir e houver estoque.
- Não permitido: produtos diferentes ou variantes diferentes no mesmo carrinho/Order; exigem compras separadas.
- Permanecem as regras existentes, como serviço `FIXED` com quantidade 1 e `QUOTE` sem checkout direto.
- Backend futuro deve impor o invariante; frontend sozinho não basta.

**CURRENT IMPLEMENTATION/CONTRACT HISTORY:** a arquitetura anterior permite múltiplos `CartItem` do mesmo Seller. O target de uma linha evita mistura de categorias, múltiplos `releaseEligibleAt`, divisão de retenção e resolução parcial por itens de categorias distintas.

## 6. Liberação Acelerada

**OWNER TARGET / NOT IMPLEMENTED:** cada regra publicada indicará `ACCELERATED RELEASE ELIGIBLE` ou `NOT ELIGIBLE`; aceleração não é universal. Quando habilitada e qualificada, reduz o frozen base protection delay em 50%:

```text
acceleratedDelay = frozenBaseDelay / 2
acceleratedTargetAt = protectionStartAt + acceleratedDelay
effectiveAcceleratedEligibleAt = MAX(acceleratedTargetAt, accelerationQualifiedAt)
```

A futura unidade/duração deve produzir divisão determinística, sem arredondamento manual de dias. Nenhum evento pode liberar dinheiro retroativamente antes de ocorrer.

No baseline inicial, as duas rules elegíveis de 4 dias podem resultar em 2 dias quando qualificadas. Não há rule de 7 dias com aceleração habilitada nesse baseline. Uma versão futura poderia habilitá-la; nesse caso, 7 dias seriam divididos deterministicamente em 3 dias e 12 horas, sem arredondamento manual.

São necessárias **as duas** condições autoritativas:

1. Buyer confirmou recebimento/entrega;
2. Buyer realizou avaliação positiva do Seller vinculada à compra.

Seller marcar entrega, clique client-only, sucesso visual ou rating mock não bastam. **RATING DEPENDENCY — NOT IMPLEMENTED:** o estado atual não possui rating persistente e autoritativo adequado para liberar dinheiro. A futura avaliação exige ownership, vínculo com Order, server timestamp, persistência, idempotência quando aplicável e auditoria, protegendo contra spoof, replay e uso em Order alheio.

Edição, exclusão, mudança positiva/negativa e recurso de rating com efeito financeiro permanecem `DECISION REQUIRED`.

Uma Dispute `OPEN`, `UNDER_REVIEW` ou qualquer bloqueio financeiro autoritativo prevalece sobre liberação base ou acelerada, mesmo após vencimento da data e satisfação das duas condições. Liberação Acelerada não é pagamento instantâneo.

## 7. System notices no Order Chat

Este target amplia a rastreabilidade de `QA-BROWSER-015`, que permanece `OPEN — NOT IMPLEMENTED`.

- Após `Payment = PAID` e elegibilidade do Order Chat: notice `SYSTEM / LIT BUY` persistente informa o prazo base congelado, que começa após `COMPLETED`, a elegibilidade de aceleração e suas condições, e que “Reportar problema” continua disponível. Ainda pode não haver data exata.
- Após `COMPLETED`: novo notice informa `baseReleaseEligibleAt` exato calculado pelo backend e esclarece que reporting continua possível após a data, embora ressarcimento pós-release possa depender de recovery.
- Se a aceleração qualificar depois: materializar **novo** notice com data/hora efetiva; não editar notice anterior.

Notices serão persistentes, imutáveis, idempotentes, versionados e sem `senderUserId` falso. Eles comunicam informação financeira; não são sua autoridade.

## 8. Disputa antes e depois da liberação

### Antes da liberação

Uma disputa ativa impede release na data base ou acelerada; proceeds permanecem protegidos/reservados. Se o Buyer vencer, o valor protegido é destinado a recovery/ressarcimento. Se o Seller vencer antes da data original, permanece `SELLER_HELD` até ela. Se vencer depois, não nasce novo prazo: sem outro bloqueio, pode ficar elegível imediatamente após a resolução autoritativa.

### Depois da liberação

Mesmo após `SELLER_HELD -> SELLER_AVAILABLE`, o Buyer pode reportar. Se vencer, não se presume que os recursos originais continuem retidos nem se promete refund instantâneo: o sistema futuro tenta recovery legítimo do Seller e registra o faltante como déficit.

## 9. SELLER_DEFICIT e recovery

`SELLER_DEFICIT` já existe na foundation atual e é derivado do Ledger append-only/entries compensatórias; não criar balance field nem editar `deficitMinor`.

Após decisão definitiva/executável favorável ao Buyer, o **sistema futuro automaticamente** registra a obrigação, recupera/reserva recursos elegíveis, impede saque deles, registra `SELLER_DEFICIT` para o faltante e coloca o claim na fila do Seller. O valor decidido não pode ser automaticamente igualado ao total do Order; fee, refund e responsabilidades continuam em revisão.

Recovery é segregado por Seller. Seller A nunca financia obrigação do Seller B. Cada obrigação preservará conceitualmente Seller originador, Order/Dispute, Buyer credor, valores decidido/recuperado/autorizado/pago e saldo restante; schema e nomes de buckets são `DESIGN REQUIRED`.

### FIFO e parcial

- Claims do mesmo Seller são satisfeitos em FIFO pela data em que a decisão se tornou definitiva/executável.
- Pagamento/liberação parcial ao Buyer é permitido; o restante conserva a prioridade FIFO.
- Uma Central Admin pode ser visualmente única, sem misturar recursos entre Sellers.

### Recovery automático versus Buyer release humano

Recovery/reserva e déficit são automáticos após decisão definitiva. Transformar valor recuperado em saldo sacável do Buyer exige autorização humana autenticada, server-side, idempotente e auditável, com actor/timestamp e sem edição direta do Ledger. Baseline: `ADMIN`; permissão financeira granular futura é target, sem declarar role `MODERATOR` implementada.

### Novas vendas e déficit

Proceeds de nova venda respeitam integralmente a própria proteção, inclusive aceleração válida. Enquanto `SELLER_HELD`, não amortizam dívida antiga. Somente após sua data efetiva, sem disputa/bloqueio, deixam de virar dinheiro sacável e amortizam prioritariamente `SELLER_DEFICIT`, destinando recovery aos claims FIFO daquele Seller.

## 10. Seller top-up e saldo futuro do Buyer

**Seller “Depositar saldo” — `NOT IMPLEMENTED / FINANCIAL-SENSITIVE / HUMAN-PROD-REVIEW`:** fluxo futuro passa por solicitação, Pix/PSP, confirmação autoritativa, persistência, idempotência, conciliação, Ledger e amortização. Não é campo editável nem Admin adicionando saldo. Confirmado, pode amortizar déficit porque não pertence a outra venda protegida. Sobra acima do déficit é `DECISION REQUIRED`.

**Buyer financial balance — `NOT IMPLEMENTED / FINANCIAL-SENSITIVE / HUMAN-PROD-REVIEW`:** após autorização humana, recovery vai a uma foundation própria de Ledger para saldo futuro disponível a saque; não reutiliza `SELLER_AVAILABLE` e não cria `buyer.balance`. Buyer wallet sacável completo e execução de saque não existem atualmente.

## 11. Boundary de withdrawal

`SELLER RELEASE POLICY` governa `COMPLETED -> SELLER_HELD -> SELLER_AVAILABLE`. `WITHDRAWAL POLICY` governa o processo posterior, quando o Seller já tem `SELLER_AVAILABLE` e solicita retirada externa. Hierarquia e aceleração pertencem à primeira e não alteram SLA de withdrawal.

## 12. Decisões abertas

Permanecem `DECISION REQUIRED` ou `HUMAN-PROD-REVIEW`:

- múltiplas disputas, máximo de um caso ativo, reabertura e novo caso após resolução;
- schema exato de Dispute e da hierarquia de policy;
- modelo exato de rating e edição/revogação com impacto financeiro;
- nomes exatos de Ledger buckets de recovery/Buyer;
- sobra de Seller top-up;
- refund total/parcial, platform commission, PSP fees, responsabilidade financeira, refund no método original e chargeback;
- payout real, Buyer KYC/withdrawal e recursos já transferidos externamente;
- Seller encerrado/deletado, compliance/regulação e permissões granulares além de `ADMIN`.

Estas decisões abertas não reabrem as decisões fechadas neste contrato e exigem desenho/revisão próprios antes de dinheiro real.
