# Leitura de pedidos do comprador no frontend

## Escopo e endpoints

As superfícies autenticadas `/pedidos`, `/pedidos/$id` e “Pedidos recentes” de `/perfil` leem exclusivamente `GET /api/v1/orders` e `GET /api/v1/orders/:orderCode`. Não há mutação, cancelamento, checkout, pagamento, gateway ou fallback mock nesta integração.

## Contrato, validação e dinheiro

`src/services/orders/types.ts` espelha o DTO emitido por `order-read.mapper.ts`, sem IDs internos nem campos reconstruídos do catálogo. Toda resposta entra em `apiFetch<unknown>` e passa pelos parsers de lista, pedido, seller, item, paginação, datas, moeda, dinheiro e pelos quatro enums fechados. Incompatibilidades produzem `MALFORMED_RESPONSE`.

Valores BRL permanecem strings decimais de unidades mínimas (até 100 dígitos). `formatBrlMinor` valida o valor e usa `BigInt`, sem conversão por `number`, para produzir texto em reais sem perda de precisão.

## Autenticação, queries e segurança

O service usa a autenticação padrão de `apiFetch`; as queries somente são renderizadas dentro de `AuthGate`. As chaves são `['buyer-orders', page, limit, status]` e `['buyer-order', orderCode]`, com cache curto, refetch ao focar e até duas tentativas transitórias, nunca para 401, 403 ou 404.

O detalhe usa a mesma mensagem para 404, código inválido e indisponibilidade para a conta: “Pedido não encontrado ou indisponível para esta conta.” Isso preserva a proteção contra enumeração/IDOR e não expõe detalhes internos.

## Interface e limitações

A lista oferece filtro por status, paginação conservadora (próxima somente quando a página está cheia), loading, vazio, erro e retry. O detalhe mostra snapshots históricos de seller e itens, valores e os estados independentes de pedido, pagamento, entrega e disputa. Não consulta catálogo nem mostra imagens, chat, timeline, ações comerciais ou meios de pagamento. O perfil limita a consulta real a cinco registros e isola seu erro; métricas mockadas de pedidos/compras ficam ocultas.

## Arquivos e testes

O módulo fica em `src/services/orders`, os componentes reais em `src/components/orders/BuyerOrder*` e as três rotas são os únicos consumidores de interface. `__tests__/buyer-orders-parser.test.ts` cobre contrato, enums e casos malformados; `__tests__/buyer-orders-service.test.ts` cobre URLs, autenticação padrão, parsing e preservação de erros HTTP.
