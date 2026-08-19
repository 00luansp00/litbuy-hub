# LIT Buy — contrato de Refund / Delivery Guarantee

**Classificação:** `OWNER-AUTHORIZED TARGET CONTRACT` · `PRE-HANDOFF FINANCIAL CONTRACT` · `NOT IMPLEMENTATION EVIDENCE`

## 1. Autoridade, escopo e estado

Este contrato é a autoridade específica de **target** para Refund / Delivery Guarantee após seu merge. Ele detalha, sem substituir, `OWNER_COMMERCIAL_FINANCIAL_DECISION_FREEZE_2026-08-18.md`; não reescreve história, não altera o Alpha e não prova implementação ou production readiness. Código, migrations, testes e documentos CURRENT continuam sendo autoridade da implementação; a Master Matrix continua sendo autoridade de planejamento; auditorias e checkpoints continuam válidos apenas no respectivo corte temporal.

**Estado honesto:** refund financeiro não está implementado de ponta a ponta; refund real no PSP não está homologado; recovery pós-release não está implementado; e saldo financeiro sacável do Buyer não está implementado. Este documento define semântica, limites e gates para implementação incremental futura. Não escolhe PSP, buckets finais, regra jurídica ou regra de chargeback.

## 2. Vocabulário que não pode ser colapsado

| Termo | Semântica autoritativa de target |
| --- | --- |
| **CANCELLATION** | Exclusivamente pré-pagamento, para Order `PENDING_PAYMENT`. Order já pago não é cancelado para devolver dinheiro. |
| **REFUND** | Reversão autorizada após pagamento, parcial ou total, com lifecycle financeiro próprio. Não é chargeback nem mera edição de Order. |
| **CHARGEBACK** | Evento externo do provider/card network, em fluxo independente. Não reutiliza Refund; refund anterior seguido de chargeback exige reconciliation e nunca pagamento duplo. |
| **DISPUTE / REPORTAR PROBLEMA** | Abertura de caso. Reporting é vitalício; abrir caso não decide nem executa refund. |
| **FINANCIAL PROTECTION** | Janela em que proceeds ainda estão protegidos/retidos. Não é a janela vitalícia de reporting. |
| **DELIVERY GUARANTEE** | Conjunto de regras que pode produzir decisão favorável ao Buyer; não é garantia monetária infinita. Reporting vitalício não significa retenção eterna. |
| **RECOVERY** | Processo posterior para satisfazer obrigação já decidida quando os recursos originais não estão mais totalmente protegidos/disponíveis. |

Fluxo semântico: **Reportar problema → caso → investigação/mediação → decisão → possível obrigação financeira → possível autorização de refund/recovery**. Buyer não escolhe arbitrariamente o amount, frontend não muda `Payment` para `REFUNDED`, e reportar não movimenta dinheiro.

## 3. Estados CURRENT preservados

Este contrato não redesenha state machines:

- Order: `PENDING_PAYMENT`, `ACTIVE`, `COMPLETED`, `CANCELLED`, `EXPIRED`, `REFUNDED`, `CHARGEBACK`;
- Payment: `NOT_CREATED`, `PENDING`, `PROCESSING`, `PAID`, `FAILED`, `EXPIRED`, `REFUND_PENDING`, `PARTIALLY_REFUNDED`, `REFUNDED`, `CHARGEBACK`.

Somente refund **total confirmado** pode levar Order a `REFUNDED`. Refund parcial mantém Order `ACTIVE` ou `COMPLETED`, conforme seu lifecycle. `CANCELLED` permanece pré-pagamento e `CHARGEBACK` permanece separado. A foundation CURRENT contém estados e primitives financeiras, mas não constitui um refund engine completo; divergência futura entre runtime e target exige reconciliação explícita, não correção inventada por este documento.

## 4. Amount autoritativo: total e parcial

Refund pode ser **TOTAL** ou **PARCIAL**. Seu amount é parte da decisão autoritativa; é proibido usar `refundAmount = Order.total` automaticamente sem que a decisão assim determine. Responsabilidade não pode ser inferida somente do gross do Order, valor pago, saldo do Seller, status visual ou frontend.

- Total afeta o principal elegível efetivamente decidido e somente se conclui após confirmação autoritativa.
- Parcial afeta apenas a parcela decidida e não muda o Order para `REFUNDED`.
- Refunds cumulativos não podem exceder o valor elegível original.
- Amounts devem usar integer minor units; rateio/arredondamento deve reutilizar o mecanismo financeiro canônico, nunca float.
- Request, execução, callback e postings exigem idempotência; retry não pode duplicar refund.

Limite cumulativo, minor units e idempotência são **IMPLEMENTATION SAFETY REQUIREMENTS**, não novas decisões comerciais.

## 5. Decomposição econômica e fees próprias

### 5.1 Regra Owner fechada

Em refund total ou parcial, as fees percentuais **próprias da LIT Buy** correspondentes à parcela revertida também são revertidas. O target inclui Prata, Ouro, Diamante e Seller MAX:

- total: reversão integral do componente próprio relativo à venda reembolsada;
- parcial: reversão proporcional à parcela de produto efetivamente reembolsada.

Essas fees pertencem economicamente à LIT Buy e não continuam cobradas do Seller sobre venda revertida. Exemplo meramente conceitual: produto R$100, Diamante R$12,99 e MAX R$2,99; se o produto tiver refund total e ambos forem aplicáveis/reversíveis, a LIT Buy reverte seus R$15,98. O engine não pode, sem decomposição, concluir “Seller deve R$100”. O exemplo não decide PSP fee, VIP, impostos ou responsabilidade adicional.

### 5.2 `PLATFORM_COMMISSION` CURRENT versus tiers target

CURRENT possui `PLATFORM_COMMISSION`, com valor/regra snapshotados no Order; o target futuro possui Prata/Ouro/Diamante. Esse fato de implementação não autoriza presumir que `PLATFORM_COMMISSION` deva ser revertida segundo a policy dos tiers, nem autoriza presumir que ela não deva ser revertida. Sua identidade econômica e semântica precisa primeiro ser reconciliada com o modelo target: o mapping/migração é `IMPLEMENTATION DESIGN / RECONCILIATION REQUIRED`. O engine trabalha sobre os componentes efetivamente snapshotados no Order, não recalcula Order histórico pela policy vigente no dia do refund e nunca cobra ou reverte `PLATFORM_COMMISSION` + tier em duplicidade. Se a reconciliação futura provar que o componente corresponde a uma fee própria reversível, ele só poderá ser revertido uma vez; essa possibilidade não é uma decisão Owner já fechada.

### 5.3 PSP fee externo

`PSP_FEE_EXPENSE` é custo externo reconciliado, não fee comercial própria. Este contrato não afirma que o PSP sempre ou nunca devolve sua fee, nem atribui sempre o custo ao Seller ou à LIT Buy. Tratamento é `EXTERNAL_PROVIDER_DECISION` + `HUMAN_PROD_REVIEW`. A ausência de decisão não autoriza lançar PSP fee silenciosamente em `SELLER_DEFICIT`.

## 6. Buyer VIP e SLAs

VIP Básico/Premium são fees/add-ons Buyer-side, semanticamente distintos de tier/MAX. As fontes não fecham de modo inequívoco refund integral, proporcional, não refund ou consumo do benefício: seu tratamento financeiro é **OWNER DECISION REQUIRED BEFORE REFUND ENGINE**.

Os SLAs já fechados são operacionais: com refund já decidido/autorizado **e recursos disponíveis**, VIP Básico tem target de processamento de até **12 horas corridas** e VIP Premium de até **6 horas corridas**. Eles não decidem o caso, não garantem funding, não começam ao clicar “Reportar problema” e não prometem refund instantâneo. SLA standard não foi localizado como decisão Owner fechada e permanece aberto.

## 7. LIT Points

### 7.1 Buyer LP ganho em compra monetária

Quando a compra monetária é reembolsada, o Buyer LP concedido em razão do principal reembolsado é revertido proporcionalmente: total reverte toda a concessão vinculada ao principal; parcial reverte a parcela correspondente. Refund nunca concede LP novo. A implementação deve usar provenance, lotes e causation, nunca editar `user.points`. O tratamento quando LP já foi gasto permanece `OWNER/DESIGN DECISION REQUIRED`.

### 7.2 Compra integralmente paga em LP

O target não possui mixed tender. A redemption rate congelada é `100 LP = R$1` (`1 LP = R$0,01` de purchasing power interno). Refund devolve LP, jamais dinheiro, não cria novo Buyer earn, e os pontos restaurados recebem novo prazo de três meses desde a nova disponibilidade. Refund parcial devolve a quantidade correspondente à parcela decidida segundo a rate congelada no Order; policy/cotação futura não recalcula Order histórico.

### 7.3 Seller LP via MAX

A fórmula de earn está fechada, mas as fontes não fecham inequivocamente se Seller LP de venda MAX é revertido total, proporcionalmente ou de outro modo. Isso é **OWNER DECISION REQUIRED BEFORE LITPOINTS-REFUND ENGINE** e não bloqueia as regras Buyer acima.

## 8. Tender monetário e confirmação externa

Para Pix, cartão, boleto ou futuro meio monetário, clique Admin não conclui refund. O fluxo futuro separa:

`REQUESTED/AUTHORIZED → provider execution → authoritative confirmation → local reconciliation/postings`.

Destino real — método original, provider balance ou outro mecanismo legalmente permitido —, callbacks, limites e semântica de execução dependem do PSP/contrato homologado: `EXTERNAL_PROVIDER_DECISION / HUMAN_PROD_REVIEW`. Resultado ambíguo, unknown ou timeout não é success e não pode liberar ou duplicar valores; nunca fabricar confirmação externa.

## 9. Pre-release versus post-release/recovery

### 9.1 Pre-release

Com recursos protegidos, disputa ativa bloqueia release normal/MAX. Recursos protegidos da própria venda são usados primeiro para cumprir a decisão; parcela destinada ao Buyer não é liberada ao Seller. O Ledger usa entries append-only/compensatórias, sem editar saldo e sem usar outro Seller/Order. **Principal decidido** e **funding source** são conceitos distintos. Recursos suficientes não criam déficit artificial; se insuficientes, somente o faltante legitimamente atribuível ao Seller segue para recovery/deficit.

### 9.2 Post-release

Reporting continua possível após `deliveredAt`, confirmação Buyer, `COMPLETED`, `releaseEligibleAt` e `SELLER_AVAILABLE`. Decisão Buyer-side posterior não presume recursos ainda retidos: recovery recupera/reserva apenas o elegível; somente o faltante legitimamente atribuível ao Seller vira `SELLER_DEFICIT`; o claim pode permanecer parcialmente outstanding. Recursos recuperados ficam reservados até autorização humana de payout. Não há promessa de pagamento imediato. Preserva-se FIFO por Seller do Recovery contract, nunca cross-Seller.

## 10. `SELLER_DEFICIT` não é gross

`SELLER_DEFICIT` não é, por definição, Order gross nem refund gross. Antes de criar déficit, o engine deve decompor: principal decidido; reversão das fees próprias seller-side cuja policy esteja autorizada — Prata/Ouro/Diamante/MAX seguem a regra Owner fechada, enquanto a CURRENT `PLATFORM_COMMISSION` depende primeiro da reconciliação da seção 5.2 —; recursos protegidos/recuperáveis do Seller; amounts já recuperados e pagos; e outras responsabilidades explicitamente contratadas. PSP fee permanece separada e depende de provider/revisão; VIP permanece `OWNER DECISION REQUIRED` e deve ser tratado como componente Buyer-side separado. O déficit é exclusivamente a obrigação remanescente legitimamente atribuível ao Seller. Sellers nunca são cruzados, e nenhuma equivalência financeira pode ser inferida sem autoridade.

## 11. Buyer financial balance e payout

Este contrato não cria Buyer wallet, bucket ou `buyer.balance`. A future Buyer financial balance é foundation separada e não usa `SELLER_AVAILABLE`. Recovery fica reservado; payout/crédito sacável exige autorização humana (`ADMIN` como baseline), enquanto o nome granular da permission é `DESIGN REQUIRED`. Payout real, KYC e controles de produção são `HUMAN_PROD_REVIEW`. Refund confirmado diretamente pelo PSP e recovery credit interno são fluxos distintos.

## 12. Chargeback independente

Chargeback pode ocorrer após `PAID`, `PARTIALLY_REFUNDED` ou `REFUNDED`. Ele não usa Refund como se fosse o mesmo evento. Provider event deve ser autoritativo/verificado; refund anterior + chargeback exige reconciliation e não cria segunda compensação silenciosa ao Buyer. Responsabilidade econômica final continua `HUMAN_PROD_REVIEW / provider contract` enquanto não decidida.

## 13. Inventory/restock

Refund não devolve estoque automaticamente. Restock total/parcial, serviço consumido, digital entregue, conta transferida e quantidade N da mesma SKU permanecem `DOMAIN DESIGN REQUIRED / DOMAIN POLICY REQUIRED`, pois recoverability varia. A lacuna não bloqueia o contrato financeiro.

## 14. Autorização e safety obrigatórios

Refund é mutação financeira sensível. A implementação futura exige backend authority, ownership, autorização Admin, futura permission granular, step-up/2FA, actor/timestamp, reason/decision linkage, idempotency key, audit imutável, bounds autoritativos e proibição de manual balance edit. Este contrato não inventa o nome final da permission.

O Ledger double-entry append-only é autoridade: somente compensating entries, sem delete/update de posting histórico. São obrigatórios idempotência de request e callback, limite agregado de parciais, reconciliation de unknown/timeout e de refund + chargeback, e retry sem duplicidade. Resultado provider ambíguo não é sucesso nem autorização automática de release. Buckets finais ainda abertos não são definidos aqui.

## 15. Traceability matrix

| Component | Original charged party | Economic owner | Refund total | Refund partial | Funding source | Seller liability? | Buyer treatment | Current status | Authority | Implementation gate |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Product principal | Buyer/tender | Seller proceeds, sujeito à decomposição | Principal decidido, não gross automático | Somente parcela decidida | Protected funds ou recovery | Só obrigação remanescente atribuível | Money segue provider; LP volta como LP | Engine `NOT IMPLEMENTED` | Freeze + este contrato | Decision linkage, snapshot, ledger, idempotência |
| Current `PLATFORM_COMMISSION` | Seller | Identidade econômica requer reconciliação | `IMPLEMENTATION DESIGN / RECONCILIATION REQUIRED` | `IMPLEMENTATION DESIGN / RECONCILIATION REQUIRED` | Não inferir até reconciliação | Não inferir | Não inferir refund nem non-refund | Valor/regra snapshotados CURRENT; refund semantics não decidida | CURRENT snapshot + Refund contract boundary | Reconciliar economic identity/mapping com tiers antes do refund engine; nunca duplicar cobrança/reversão |
| Prata | Seller | LIT Buy | Reversão integral aplicável | Proporcional | Reversal da LIT Buy | Não | Indireto na decomposição | Target `NOT IMPLEMENTED` | Freeze | Snapshot + engine |
| Ouro | Seller | LIT Buy | Reversão integral aplicável | Proporcional | Reversal da LIT Buy | Não | Indireto na decomposição | Target `NOT IMPLEMENTED` | Freeze | Snapshot + engine |
| Diamante | Seller | LIT Buy | Reversão integral aplicável | Proporcional | Reversal da LIT Buy | Não | Indireto na decomposição | Target `NOT IMPLEMENTED` | Freeze | Snapshot + engine |
| Seller MAX fee | Seller | LIT Buy | Reversão integral aplicável | Proporcional | Reversal da LIT Buy | Não | Indireto na decomposição | Target `NOT IMPLEMENTED` | Freeze | Snapshot + engine |
| Buyer VIP Basic | Buyer | `OWNER DECISION REQUIRED` | `OWNER DECISION REQUIRED` | `OWNER DECISION REQUIRED` | `OWNER DECISION REQUIRED` | Não inferir | SLA 12h só após decisão + funding | `NOT IMPLEMENTED` | Owner decision pendente | Before refund engine |
| Buyer VIP Premium | Buyer | `OWNER DECISION REQUIRED` | `OWNER DECISION REQUIRED` | `OWNER DECISION REQUIRED` | `OWNER DECISION REQUIRED` | Não inferir | SLA 6h só após decisão + funding | `NOT IMPLEMENTED` | Owner decision pendente | Before refund engine |
| External PSP fee | Conforme provider | Provider/custo externo | `EXTERNAL_PROVIDER_DECISION` | `EXTERNAL_PROVIDER_DECISION` | Provider/contract dependent | Não atribuir silenciosamente | Separado do principal | Foundation `PSP_FEE_EXPENSE`; policy aberta | Provider contract | `EXTERNAL_PROVIDER_DECISION` + `HUMAN_PROD_REVIEW` |
| Buyer LP earned from money purchase | Plataforma concede | Buyer reward interno | Reverter concessão causal | Reverter proporcionalmente | Lote/provenance LP | Não | Nunca novo earn; gasto prévio aberto | Engine `NOT IMPLEMENTED` | Freeze | LP ledger; gasto prévio `OWNER/DESIGN DECISION REQUIRED` |
| LP used as tender | Buyer | Purchasing power interno | Restaurar LP, não dinheiro | Restaurar LP pela rate congelada | LP ledger | Seller permanece em BRL conforme target | Novo prazo de 3 meses; zero earn | Engine `NOT IMPLEMENTED` | Freeze | LP ledger + idempotência |
| Seller LP earned via MAX | Plataforma concede | Seller reward interno | `OWNER DECISION REQUIRED` | `OWNER DECISION REQUIRED` | `OWNER DECISION REQUIRED` | Não inferir | N/A | Engine `NOT IMPLEMENTED` | Owner decision pendente | Before LITPOINTS-refund engine |
| `SELLER_HELD` resources | Seller, protegidos | Seller subject to Buyer protection | Usar primeiro até obrigação decidida | Usar somente parcela decidida | Própria venda protegida | Evita déficit artificial | Funding do refund | Bucket CURRENT; flow futuro | Recovery + este contrato | Atomic blocker/postings |
| `SELLER_AVAILABLE`/recoverable resources | Seller | Seller até recovery legitimamente executável | Recuperar somente elegível | Recuperar somente elegível | Mesmo Seller | Somente nos bounds decididos | Reservar; não prometer imediato | Bucket CURRENT; recovery não implementado | Recovery | Recovery engine + FIFO |
| `SELLER_DEFICIT` | N/A | Obrigação Seller remanescente | Nunca gross por default | Nunca gross por default | Faltante atribuível | Sim, somente residual legítimo | Claim pode ficar outstanding | Bucket/read CURRENT; mutation não | Recovery + este contrato | Decomposição + ledger |
| Buyer recovery reservation | Recovery do mesmo Seller | Buyer claim, ainda não payout | Reservar recovered amount | Reservar recovered amount | Recovery elegível | Já refletida na obrigação | Payout humano separado | `NOT IMPLEMENTED` | Recovery | Permission design + `HUMAN_PROD_REVIEW` |
| Chargeback | Provider/card network | `HUMAN_PROD_REVIEW` | Não é refund | Pode suceder parcial | Provider/reconciliation | `HUMAN_PROD_REVIEW` | Nunca dupla compensação | Estado foundation; engine completo não | Provider contract | Verified event + reconciliation |
| Inventory/restock | Domain-dependent | Domain-dependent | `DOMAIN DESIGN REQUIRED` | `DOMAIN DESIGN REQUIRED` | N/A | N/A | Sem restock automático | Não definido por refund | Domain policy | `DOMAIN DESIGN REQUIRED` |

## 16. Open decision register

### OWNER DECISION REQUIRED BEFORE REFUND ENGINE

- tratamento financeiro de Buyer VIP Basic/Premium: total, proporcional, não reembolsável e/ou condições de consumo;
- Seller LP via MAX após refund total/parcial;
- tratamento de Buyer LP causal já gasto antes da reversão;
- SLA standard de refund processing;
- instante técnico `PENDING → AVAILABLE` de LP, conforme freeze/matrix, onde necessário ao refund.

### EXTERNAL_PROVIDER_DECISION

- destino/execução real do refund e original method ou alternativa permitida;
- restituição, retenção e responsabilidade por PSP fee;
- callbacks/eventos autoritativos e estados ambíguos;
- limites, janelas, partial support e demais constraints do provider.

### HUMAN_PROD_REVIEW

- responsabilidade econômica de chargeback;
- payout real e autorização operacional;
- reconciliation de dinheiro real;
- Buyer KYC/withdrawal;
- revisão contábil/financeira e controles de produção.

### DOMAIN DESIGN REQUIRED

- inventory/recoverability e restock total/parcial para serviço consumido, digital entregue, conta transferida e quantidade N da mesma SKU.

Estas lacunas impedem inferência silenciosa; não convertem decisão externa em decisão Owner nem fazem o contrato parecer um engine implementado.
