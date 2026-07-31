Status: arquitetura aprovada para implementação incremental
Escopo: carrinho, checkout, pedidos, estoque e fronteira financeira
Implementação: ainda não iniciada

# Arquitetura comercial autoritativa

Este documento é a fonte de verdade do domínio comercial. Ele congela contratos futuros, não implementa carrinho, pedido, pagamento, ledger ou integração financeira. O sistema não está pronto para dinheiro real.

## Carrinho por vendedor

Cada carrinho ativo pertence a um comprador e a um único vendedor. Há no máximo um carrinho ativo por combinação `buyerUserId + sellerProfileId`; produtos de vendedores diferentes nunca ficam no mesmo carrinho. Um comprador pode manter carrinhos separados, finalizados separadamente. Não haverá checkout multivendedor na primeira implementação. Isso evita um pagamento com vários vendedores, múltiplas retenções, rateio, cancelamentos parciais e chargebacks distribuídos.

Adicionar ao carrinho **não reserva estoque** nem reduz disponibilidade. Preço, publicação, seller, variante e estoque são revalidados no servidor no checkout. Carrinho não é fonte de verdade; item pausado, removido ou alterado será reconciliado antes do checkout.

### Itens compráveis

- produto `NORMAL`: preço público atual e reserva no estoque do produto;
- produto `DYNAMIC`: variante ativa obrigatória e reserva no estoque da variante;
- serviço `FIXED`: quantidade exatamente 1, sem reserva de estoque inicialmente; capacidade futura requer modelo próprio;
- serviço `QUOTE`: proibido no carrinho e checkout direto, com `PRODUCT_REQUIRES_QUOTE`;
- item sem preço público válido: não comprável.

## Modelo conceitual do carrinho

`Cart`: `id`, `buyerUserId`, `sellerProfileId`, `status`, `version`, `createdAt`, `updatedAt` e, se adotado, `expiresAt`. Somente o comprador proprietário altera; seller/admin não alteram. Operações usam versão otimista. A combinação comprador-vendedor tem no máximo um ativo.

`CartItem`: `id`, `cartId`, `productId`, `productVariantId` quando aplicável, `quantity`, `createdAt`, `updatedAt`. Preço, taxa, comissão, desconto e total definitivos não são autoridade persistida no carrinho. Uma visualização do último preço observado pode existir se marcada como não autoritativa.

## Checkout server-side

O cliente envia somente identificadores e intenção. O backend: (1) autentica o comprador; (2) carrega o carrinho persistente; (3) confirma um seller; (4) busca produtos/variantes atuais; (5) valida publicação/disponibilidade; (6) recalcula preços; (7) cria snapshots imutáveis; (8) reserva estoque aplicável; (9) cria pedido `PENDING_PAYMENT`; (10) grava evento; (11) devolve resultado idempotente.

O frontend jamais é autoridade de preço, subtotal, desconto, taxa, comissão, total, saldo, estoque, seller, status ou moeda e não escolhe estado de destino.

## Dinheiro

Moeda inicial `BRL`; toda operação explicita moeda. Valores persistentes usam unidades mínimas inteiras e PostgreSQL `BIGINT` em centavos, nunca `float`/`double`. O backend converte o preço atual para centavos. A representação interna TypeScript usa `bigint` ou value object próprio. A representação JSON autoritativa de `amountMinor` é sempre uma string decimal canônica; `bigint` nunca é serializado diretamente e número JSON nunca é aceito para dinheiro autoritativo. A string contém somente dígitos, sem ponto decimal, sinal positivo, sinal negativo, notação exponencial, espaços ou zeros à esquerda (exceto `"0"`). Limites são validados no backend. Arredondamento é centralizado e testado.

```json
{ "currency": "BRL", "amountMinor": "4990" }
```

## Pedido e snapshot imutável

`Order`: UUID interno, código público não sequencial, comprador, vendedor, moeda, subtotal, desconto aprovado, taxa da plataforma, total, status geral, status de pagamento, entrega e disputa, versão, expiração de pagamento e timestamps. Pertence exatamente a um comprador, um vendedor e uma moeda.

`OrderItem` preserva snapshot imutável: ID/versão do produto, ID de variante, seller ID, nome público da loja, slug, título, título de variante, tipo, modelo, entrega, preço unitário em centavos, quantidade, total da linha, moeda, dados públicos necessários ao cumprimento e versão da política comercial. Alterações do anúncio não alteram pedidos. Excluem-se conta privada, object keys de storage, recuperação, notas internas e dados pessoais desnecessários.

## Máquinas de estado separadas

- `OrderStatus`: `PENDING_PAYMENT`, `ACTIVE`, `COMPLETED`, `CANCELLED`, `EXPIRED`, `REFUNDED`, `CHARGEBACK`.
- `PaymentStatus`: `NOT_CREATED`, `PENDING`, `PROCESSING`, `PAID`, `FAILED`, `EXPIRED`, `REFUND_PENDING`, `PARTIALLY_REFUNDED`, `REFUNDED`, `CHARGEBACK`.
- `FulfillmentStatus`: `NOT_AVAILABLE`, `AWAITING_SELLER`, `DELIVERED`, `AWAITING_BUYER_CONFIRMATION`, `CONFIRMED`.
- `DisputeStatus`: `NONE`, `OPEN`, `UNDER_REVIEW`, `RESOLVED_BUYER`, `RESOLVED_SELLER`, `CLOSED`.

Cada mudança é comandada por operação backend autorizada, nunca por um destino escolhido pelo frontend. “idem” abaixo significa repetição sem novo efeito.

### Matriz completa de transições permitidas

| Máquina     | Origem → destino                        | Ator                       | Pré-condição                                   | Estoque                  | Efeito financeiro futuro        | Evento                       | Idempotência       | Reversão                         |
| ----------- | --------------------------------------- | -------------------------- | ---------------------------------------------- | ------------------------ | ------------------------------- | ---------------------------- | ------------------ | -------------------------------- |
| Order       | PENDING_PAYMENT → ACTIVE                | sistema/webhook verificado | pagamento PAID                                 | consome reserva          | reconhecer clearing/pending     | `order.activated`            | idem por pagamento | só refund/chargeback             |
| Order       | PENDING_PAYMENT → CANCELLED             | comprador/sistema          | cancelável, não pago                           | libera reserva           | cancelar cobrança               | `order.cancelled`            | idem               | não                              |
| Order       | PENDING_PAYMENT → EXPIRED               | job                        | TTL vencido, não pago                          | libera reserva           | expirar cobrança                | `order.expired`              | idem               | não; pagamento tardio concilia   |
| Order       | ACTIVE → COMPLETED                      | sistema                    | fulfillment confirmado/política                | nenhum                   | liberar conforme política       | `order.completed`            | idem               | refund/chargeback                |
| Order       | ACTIVE → REFUNDED                       | sistema                    | reembolso total confirmado                     | regra de reposição       | lançamentos compensatórios      | `order.refunded`             | idem por refund    | não                              |
| Order       | COMPLETED → REFUNDED                    | sistema                    | reembolso total confirmado                     | regra de reposição       | reverter disponível             | `order.refunded`             | idem por refund    | não                              |
| Order       | ACTIVE → CHARGEBACK                     | sistema                    | aviso verificado                               | nenhum automático        | bloquear/reverter               | `order.chargeback`           | idem por evento    | conciliação                      |
| Order       | COMPLETED → CHARGEBACK                  | sistema                    | aviso verificado                               | nenhum automático        | bloquear/reverter/negativo      | `order.chargeback`           | idem por evento    | conciliação                      |
| Order       | REFUNDED → CHARGEBACK                   | sistema                    | provedor confirma                              | nenhum                   | reconciliar duplicidade         | `order.chargeback`           | idem               | conciliação                      |
| Payment     | NOT_CREATED → PENDING                   | sistema                    | intenção criada                                | mantém reserva           | criar cobrança                  | `payment.pending`            | chave obrigatória  | cancelar/expirar                 |
| Payment     | PENDING → PROCESSING                    | sistema/webhook            | evento válido                                  | mantém                   | sem reconhecimento final        | `payment.processing`         | evento único       | pode falhar                      |
| Payment     | PENDING → PAID                          | sistema/webhook            | confirmação válida                             | consome                  | clearing/pending                | `payment.paid`               | idem               | refund/chargeback                |
| Payment     | PROCESSING → PAID                       | sistema/webhook            | confirmação válida                             | consome                  | clearing/pending                | `payment.paid`               | idem               | refund/chargeback                |
| Payment     | PENDING → FAILED                        | sistema/webhook            | falha final                                    | libera se pedido encerra | registrar falha                 | `payment.failed`             | idem               | nova tentativa nova intenção     |
| Payment     | PROCESSING → FAILED                     | sistema/webhook            | falha final                                    | libera se pedido encerra | registrar falha                 | `payment.failed`             | idem               | nova tentativa                   |
| Payment     | PENDING → EXPIRED                       | job/sistema                | TTL vencido                                    | libera                   | expirar cobrança                | `payment.expired`            | idem               | conciliar tardio                 |
| Payment     | PROCESSING → EXPIRED                    | sistema                    | provedor confirma expiração                    | libera                   | expirar cobrança                | `payment.expired`            | idem               | conciliar tardio                 |
| Payment     | PAID → REFUND_PENDING                   | operação autorizada        | pedido/política permitem                       | nenhum imediato          | reservar reversão               | `refund.requested`           | chave obrigatória  | falha retorna PAID               |
| Payment     | REFUND_PENDING → PAID                   | sistema                    | tentativa falhou sem refund anterior           | nenhum                   | liberar reserva contábil        | `refund.failed`              | idem               | novo pedido de refund            |
| Payment     | REFUND_PENDING → PARTIALLY_REFUNDED     | sistema/webhook            | refund parcial confirmado                      | regra de reposição       | compensar valor parcial         | `refund.partially_completed` | idem               | novo refund/chargeback           |
| Payment     | REFUND_PENDING → PARTIALLY_REFUNDED     | sistema                    | nova tentativa falhou após refund parcial      | nenhum                   | liberar reserva da tentativa    | `refund.failed`              | idem               | novo refund/chargeback           |
| Payment     | PARTIALLY_REFUNDED → REFUND_PENDING     | operação autorizada        | saldo capturado remanescente e limite agregado | nenhum                   | reservar nova reversão          | `refund.requested`           | chave obrigatória  | falha retorna PARTIALLY_REFUNDED |
| Payment     | REFUND_PENDING → REFUNDED               | sistema/webhook            | refund total confirmado                        | regra de reposição       | compensar ledger                | `refund.completed`           | idem               | não                              |
| Payment     | PAID → CHARGEBACK                       | sistema/webhook            | evento assinado                                | nenhum                   | bloquear/reverter               | `chargeback.opened`          | evento único       | conciliação                      |
| Payment     | PARTIALLY_REFUNDED → CHARGEBACK         | sistema/webhook            | evento assinado                                | nenhum                   | bloquear/reverter e reconciliar | `chargeback.opened`          | evento único       | conciliação                      |
| Payment     | REFUND_PENDING → CHARGEBACK             | sistema/webhook            | evento assinado                                | nenhum                   | reconciliar                     | `chargeback.opened`          | evento único       | conciliação                      |
| Payment     | REFUNDED → CHARGEBACK                   | sistema/webhook            | evento assinado                                | nenhum                   | reconciliar                     | `chargeback.opened`          | evento único       | conciliação                      |
| Fulfillment | NOT_AVAILABLE → AWAITING_SELLER         | sistema                    | pedido ACTIVE                                  | nenhum                   | nenhum                          | `fulfillment.available`      | idem               | cancelamento externo             |
| Fulfillment | AWAITING_SELLER → DELIVERED             | seller/sistema             | prova de entrega                               | nenhum                   | inicia confirmação              | `fulfillment.delivered`      | idem               | disputa/correção auditada        |
| Fulfillment | DELIVERED → AWAITING_BUYER_CONFIRMATION | sistema                    | entrega exige aceite                           | nenhum                   | mantém pendente                 | `fulfillment.awaiting_buyer` | idem               | disputa                          |
| Fulfillment | DELIVERED → CONFIRMED                   | sistema                    | entrega automática/política                    | nenhum                   | elegível à liberação            | `fulfillment.confirmed`      | idem               | disputa/refund                   |
| Fulfillment | AWAITING_BUYER_CONFIRMATION → CONFIRMED | comprador/job              | aceite ou prazo                                | nenhum                   | elegível à liberação            | `fulfillment.confirmed`      | idem               | disputa/refund                   |
| Dispute     | NONE → OPEN                             | comprador/operação         | janela aberta                                  | nenhum                   | seller pending→held             | `dispute.opened`             | chave/caso         | resolução                        |
| Dispute     | OPEN → UNDER_REVIEW                     | admin/sistema              | caso íntegro                                   | nenhum                   | mantém held                     | `dispute.reviewing`          | idem               | não                              |
| Dispute     | UNDER_REVIEW → RESOLVED_BUYER           | admin                      | decisão e evidências                           | regra de reposição       | refund/compensação              | `dispute.buyer_resolved`     | decisão única      | recurso auditado                 |
| Dispute     | UNDER_REVIEW → RESOLVED_SELLER          | admin                      | decisão e evidências                           | nenhum                   | held→pending/available          | `dispute.seller_resolved`    | decisão única      | recurso auditado                 |
| Dispute     | RESOLVED_BUYER → CLOSED                 | sistema                    | efeitos concluídos                             | nenhum                   | conciliação concluída           | `dispute.closed`             | idem               | não                              |
| Dispute     | RESOLVED_SELLER → CLOSED                | sistema                    | efeitos concluídos                             | nenhum                   | conciliação concluída           | `dispute.closed`             | idem               | não                              |

Estados/arestas não listados são proibidos.

## Cancelamento, reembolso e chargeback

`CANCELLED` é exclusivamente pré-pagamento: somente `PENDING_PAYMENT` pode virar `CANCELLED`. Pedido pago nunca é cancelado e cancelamento nunca cria estorno implícito. Após pagamento, reversão total ou parcial ocorre por reembolso. `OrderStatus.REFUNDED` só é aplicado após reembolso total confirmado; reembolso parcial preserva `ACTIVE` ou `COMPLETED`, conforme o lifecycle. Chargeback é fluxo independente e não reutiliza cancelamento, reembolso ou disputa interna.

### Modelo conceitual futuro `Refund`

Campos mínimos: `id`, `paymentId`, `orderId`, `amountMinor`, `currency`, `reasonCode`, `status`, `providerRefundId`, `idempotencyKey`, `requestedByUserId`, `createdAt`, `updatedAt` e timestamps de processamento. `RefundStatus`: `REQUESTED`, `PROCESSING`, `SUCCEEDED`, `FAILED`, `CANCELLED`.

Cada tentativa possui registro próprio. A soma dos refunds `SUCCEEDED` não pode superar o valor capturado; tentativas simultâneas fazem verificação agregada e reserva do limite em uma mesma transação. Um pagamento `PARTIALLY_REFUNDED` pode receber outro refund. Falha sem refund anterior retorna o agregado a `PAID`; falha após refund parcial retorna a `PARTIALLY_REFUNDED`. Refund total confirmado muda Payment e Order para `REFUNDED`; refund parcial não muda o `OrderStatus`.

## Pagamento tardio após expiração

Pedido `EXPIRED` não volta automaticamente para `ACTIVE`; a reserva liberada não pode ser consumida novamente. Webhook tardio é persistido idempotentemente, e o sistema consulta o gateway quando necessário, cria incidente de reconciliação, não entrega automaticamente e não recria estoque artificialmente. A decisão registrada pode resultar em reembolso automático ou tratamento operacional autorizado. Nenhum estado muda silenciosamente.

## Reserva e concorrência

A reserva nasce somente ao iniciar checkout/criar pedido pendente, com TTL inicial recomendado de 15 minutos. Job backend expira; cancelamento/expiração liberam; pagamento confirmado consome. Liberação e consumo são idempotentes e a reserva reduz disponibilidade comercial. `NORMAL` reserva produto, `DYNAMIC` variante, `FIXED` não reserva e `QUOTE` não gera pedido.

A futura operação usa transação, update condicional atômico, verificação de suficiência e rollback integral, com teste de duas compras concorrentes. É proibido consultar, decidir em memória e atualizar sem condição atômica.

## Idempotência, eventos e outbox

`Idempotency-Key` é obrigatório para checkout/pedido, pagamento, cancelamento, reembolso, saque e mutações financeiras. Registro vincula ator, operação, request hash, resultado, status e expiração. Mesma chave/payload devolve o resultado; payload diferente gera `IDEMPOTENCY_KEY_REUSED`; execução parcial não duplica pedido/reserva. Webhook usa ID único do provedor.

Eventos de pedido são append-only, com transição, ator, motivo, correlação, request ID, timestamp e metadados mínimos seguros. E-mail, notificação, job, gateway, liberação de saldo e analytics usam transactional outbox; nenhum efeito externo é publicado antes do commit principal.

## Contratos preliminares de API

Todos exigem autenticação de comprador e autorização por propriedade; respostas omitem dados privados. Rate limits serão definidos por risco. Campos financeiros, seller, estoque, moeda e status enviados pelo cliente são proibidos.

| Endpoint                                         | Request                                  | Response                          | Erros                                     | Idempotência      | Efeito / rate limit futuro              |
| ------------------------------------------------ | ---------------------------------------- | --------------------------------- | ----------------------------------------- | ----------------- | --------------------------------------- |
| `GET /api/v1/carts`                              | paginação                                | carrinhos próprios reconciliáveis | —                                         | não               | leitura / moderado                      |
| `GET /api/v1/carts/:sellerSlug`                  | slug na rota                             | carrinho próprio                  | `CART_NOT_FOUND`                          | não               | leitura / moderado                      |
| `POST /api/v1/carts/:sellerSlug/items`           | productId, variantId?, quantity, version | carrinho atualizado               | produto/variante/estoque lógico, mismatch | chave recomendada | cria item, não reserva / estrito        |
| `PATCH /api/v1/carts/:sellerSlug/items/:itemId`  | quantity, version                        | carrinho atualizado               | item ausente, conflito                    | chave recomendada | altera quantidade / estrito             |
| `DELETE /api/v1/carts/:sellerSlug/items/:itemId` | version                                  | 204                               | item ausente, conflito                    | chave recomendada | remove item / estrito                   |
| `POST /api/v1/checkout-sessions`                 | cartId e intenção                        | pedido pendente + expiração       | validações e idempotência                 | **obrigatória**   | snapshot/reserva/pedido / muito estrito |
| `GET /api/v1/orders`                             | paginação/filtros permitidos             | pedidos próprios                  | —                                         | não               | leitura / moderado                      |
| `GET /api/v1/orders/:orderCode`                  | código opaco                             | pedido próprio                    | `ORDER_NOT_FOUND`                         | não               | leitura / moderado                      |
| `POST /api/v1/orders/:orderCode/cancel`          | motivo permitido                         | pedido                            | não cancelável/expirado                   | **obrigatória**   | cancela e libera reserva / estrito      |

Nenhum endpoint de pagamento está pronto ou é definido como implementado aqui.

## Catálogo mínimo de erros

`CART_NOT_FOUND`, `CART_SELLER_MISMATCH`, `CART_ITEM_NOT_FOUND`, `PRODUCT_NOT_PURCHASABLE`, `PRODUCT_REQUIRES_QUOTE`, `PRODUCT_VARIANT_REQUIRED`, `PRODUCT_VARIANT_NOT_AVAILABLE`, `PRODUCT_PRICE_CHANGED`, `INSUFFICIENT_STOCK`, `ORDER_NOT_FOUND`, `ORDER_NOT_CANCELLABLE`, `ORDER_EXPIRED`, `IDEMPOTENCY_KEY_REQUIRED`, `IDEMPOTENCY_KEY_REUSED`, `CHECKOUT_CONFLICT`. Produto oculto e inexistente têm resposta indistinguível, sem revelar informação privada.

## Fronteiras

Pagamento, ledger, webhooks, refund, chargeback e saque obedecem a `FINANCIAL_LEDGER_AND_PAYMENT_BOUNDARY.md`; riscos a `COMMERCE_THREAT_MODEL.md`; sequência a `COMMERCE_IMPLEMENTATION_ROADMAP.md`.

A fronteira financeira exige ledger futuro de partidas dobradas, balanceado e append-only; os detalhes permanecem no documento de fronteira.

## Implementation checkpoint — PR #36

The persistent authenticated buyer-cart slice described above is now implemented. It preserves one active cart per buyer/seller, current-catalog reconciliation, optimistic concurrency, and the explicit absence of reservation. The frozen checkout, immutable order snapshot, financial ledger, and payment boundaries are unchanged and remain unimplemented; cart content is current mutable intent and is not part of historical order snapshots. See `CART_FOUNDATION.md`.
