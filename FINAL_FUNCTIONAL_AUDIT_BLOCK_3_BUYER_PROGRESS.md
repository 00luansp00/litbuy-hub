# LIT Buy — Final Functional Audit — Bloco 3: Buyer — estado final

Data: 2026-08-16
Base autoritativa: `main` remoto em `44fa6c57cba4a9d458e5d7086068d6e8ccd8edd9` (merge da PR #90)

## Decisão

**O Bloco 3 — Buyer pode ser formalmente encerrado: SIM.**

O caminho crítico Buyer do Alpha local foi exercitado com browser, HTTP autenticado e PostgreSQL: carrinho, checkout, reserva, pagamento `FAKE_ALPHA`, ativação, pedidos, confirmação de recebimento, persistência após `F5`, isolamento e replays sensíveis. Não restou blocker Buyer do Alpha.

Isso não encerra Seller, não autoriza Phase B, produção, PSP/dinheiro real, payout ou saque. `QA-BROWSER-007` e `QA-BROWSER-013` permanecem `OPEN / NON_BLOCKER`; disputa completa, refund/reversal, chat e review são futuros/não implementados. A seed com um único Seller limita somente a prova browser multi-Seller.

## Evidências manuais incorporadas

Estas evidências são **browser/HTTP/PostgreSQL executadas**, não testes automatizados:

- `/pedidos` e detalhe usaram API e persistiram após `F5`; código inexistente mostrou estado seguro; outra conta não acessou pedido alheio; conta sem pedidos recebeu lista vazia; a autoridade histórica permaneceu no PostgreSQL;
- o carrinho de `comprador@demo.litbuy.local` não ficou visível a `vendedor@demo.litbuy.local` em contexto Buyer, inclusive entre sessões;
- checkout criou `InventoryReservation` com TTL padrão de 15 minutos. A reserva reduz disponibilidade sem decremento imediato do estoque persistido; expiração libera a reserva; ativação paga consome a reserva e decrementa estoque exatamente uma vez;
- no pedido `LIT-9WN8RAWU3BZTKB`, dois POSTs de `payment-attempts` com a mesma `Idempotency-Key` deixaram uma tentativa `PENDING (#1)`;
- duas confirmações `alpha-confirm` idênticas retornaram HTTP 200 e deixaram uma tentativa `SUCCEEDED`, um sucesso Alpha, uma ativação, um consumo, um `INVENTORY_CONSUMED`, um `SALE_RECOGNIZED` e Ledger `3990 = 3990`;
- a única entrega Seller serviu exclusivamente para preparar o cenário Buyer (`AWAITING_SELLER` → `AWAITING_BUYER_CONFIRMATION`), não para auditar/encerrar Seller;
- dois POSTs Buyer de confirmação retornaram HTTP 200 e deixaram uma entrega, um `FULFILLMENT_CONFIRMED`, um `ORDER_COMPLETED`, um reconhecimento e Ledger inalterado/balanceado;
- após `F5`, UI e banco permaneceram `COMPLETED / PAID / CONFIRMED / NONE`, sem CTA de confirmação e sem sucesso/erro simultâneos.

## Matriz final — carrinho e checkout

| Item | Classificação | Evidência/limite |
| --- | --- | --- |
| Add/update/remove, empty state, totais e refresh | `REAL-TESTED / PASS` | Browser + API; persistência entre sessão/refresh. |
| Persistência e isolamento Buyer A/B do carrinho | `REAL-TESTED / PASS` | Separação backend/identidade exercitada. |
| Indisponibilidade, limite 50/51 e variante duplicada | `REAL-TESTED / PASS` | Duplicata protegida por HTTP 409. |
| Replay de todos os verbos do carrinho | `AUTOMATIZADO/ESTRUTURAL APENAS` | Unicidade/versionamento existem; não houve replay manual de todo verbo. |
| Carrinhos de Sellers diferentes / checkout por Seller | `AUTOMATIZADO/ESTRUTURAL APENAS — LIMITAÇÃO DE FIXTURE` | API seleciona por `sellerSlug` e testes cobrem seleção/isolamento. Seed cria exatamente um Seller; fluxo completo com dois Sellers **não** foi browser-tested. Não é bug demonstrado. |
| Carrinho, preço, snapshots e pedido server-authoritative | `REAL-TESTED / PASS` | Pedido/snapshots/consumo do carrinho conferidos. |
| Reserva, TTL, expiração e estoque | `REAL-TESTED / PASS` + automatizado | Reserva de 15 min, liberação e consumo/decremento único; executor automático produtivo não homologado. |
| Version/fingerprint stale | `AUTOMATIZADO/ESTRUTURAL APENAS` | Guards e integração existentes; negativo manual específico não executado. |
| Idempotência de criação do pedido | `REAL-TESTED / PASS` | Refresh não recriou pedido; guards/testes cobrem chave. |
| Checkout de carrinho alheio | `REAL-TESTED / PASS` | Ownership backend exercitado. |

## Matriz final — pagamento Alpha local

| Item | Classificação | Evidência/limite |
| --- | --- | --- |
| Estado inicial e Payment/PaymentAttempt | `REAL-TESTED / PASS` | 2 POSTs com mesma chave deixaram 1 attempt. |
| `FAKE_ALPHA`, `SUCCEEDED`, `PAID`, `ACTIVE/PAID` | `REAL-TESTED / PASS` | HTTP + PostgreSQL, somente ambiente local autorizado. |
| Replay de `alpha-confirm` | `REAL-TESTED / PASS` | 2 HTTP 200; pagamento, ativação, reserva, estoque e venda únicos. |
| `SALE_RECOGNIZED`, idempotência e Ledger | `REAL-TESTED / PASS` | Um reconhecimento; débito/crédito 3990. |
| `SELLER_PENDING`; comissão | `REAL-TESTED / PASS` | Proceeds conferido; policy demo zero torna `PLATFORM_COMMISSION` `NOT-APPLICABLE` nesta prova. |
| Ausência de `HELD/AVAILABLE` prematuro/reconciliation indevida | `REAL-TESTED / PASS` | Nenhum movimento prematuro ou issue ativa. |
| Refresh / `QA-BROWSER-003` | `REAL-TESTED / PASS`; `CLOSED` | Rodadas limpas atualizaram antes de F5 e persistiram após F5; replay final coerente. Não atribuído à PR #87. |
| `QA-BROWSER-004` | `CLOSED` | Provider fake restart-safe e regressão browser/banco documentados. |
| PSP/dinheiro real | `FUTURE-SCOPE / HUMAN-SENIOR` | Não autorizado/testado. |

## Matriz final — pedidos e pós-compra

| Item | Classificação | Evidência/limite |
| --- | --- | --- |
| Lista/detalhe, código inexistente e estados do banco | `REAL-TESTED / PASS` | API, empty/safe state, PostgreSQL e F5. |
| Ownership de pedidos | `REAL-TESTED / PASS` | Buyer diferente bloqueado; outra conta viu vazio. |
| Entrega Seller como pré-condição | `REAL-TESTED somente como preparação` | Produziu estado Buyer; não fecha Seller. |
| Confirmar recebimento e replay | `REAL-TESTED / PASS` | 2 HTTP 200; entrega/eventos únicos; `COMPLETED/PAID/CONFIRMED/NONE`. |
| UI coerente e F5 pós-conclusão | `REAL-TESTED / PASS` | Sem CTA nem sucesso/erro simultâneos. |
| Efeitos financeiros | `REAL-TESTED / PASS` | `SALE_RECOGNIZED = 1`; Ledger 3990/3990. |
| `QA-BROWSER-007` | `OPEN / NON_BLOCKER` | Login perde destino de produto/carrinho. |
| `QA-BROWSER-013` | `OPEN / NON_BLOCKER` | Backend bloqueia pagamento tardio; UI pode manter CTA antes do processador. |
| Chat, review e mediação/disputa completa | `FUTURE-SCOPE / NOT-IMPLEMENTED` | Regras Buyer-win futuras permanecem no documento de lifecycle. |

## Findings e residuais

### `QA-BROWSER-003` — `CLOSED — comportamento atual revalidado`

O finding histórico permanece registrado, mas seu critério foi atendido: rodadas limpas mostraram `ACTIVE / PAID / SUCCEEDED (#1)` antes do `F5` e preservaram o estado depois; a prova final com replay manteve efeitos únicos e UI coerente. Não há residual objetivo atual e a resolução não é atribuída à PR #87, que não tocou frontend/cache.

### `QA-BROWSER-007` — `OPEN / NON_BLOCKER`

Não há correção comprovada. Produto ou `/carrinho` que levam ao login retornam à Home. Segue no remediation gate; correção futura não pode auto-adicionar item nem repetir mutation.

### `QA-BROWSER-013` — `OPEN / NON_BLOCKER`

O domínio falha fechado e o CLI expira pedido/reserva, mas não houve comprovação de executor automático default e a UI pré-materialização pode oferecer ação vencida. Segue no remediation/production-readiness gate.

### Future scope/produção

Disputa/refund/reversal/chargeback completos; reposição idempotente, fechamento de chat e bloqueio de review após Buyer-win; executor produtivo de expiração; PSP/dinheiro real/payout/saque; revisão humana sênior.

## Fundamentação do encerramento

A. **Fluxo crítico Alpha:** completo e `REAL-TESTED`.
B. **NON_BLOCKER:** `QA-BROWSER-007` e `QA-BROWSER-013` rastreáveis.
C. **Futuro/produção:** não considerado concluído.
D. **Fixture:** um Seller limita o browser multi-Seller; estrutura/testes não indicam bug.
E. **Blockers reais:** nenhum blocker Buyer atual.

Encerra-se documentalmente apenas o **Bloco 3 — Buyer**.
