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

## Validação defensiva complementar

`orderCode.ts` centraliza o padrão público `LIT-` e o parser rejeita prefixos, tamanhos, caracteres e caixa incompatíveis. O detalhe também exige que o código da resposta seja idêntico ao solicitado; divergências permanecem `MALFORMED_RESPONSE`. A página da URL é normalizada por uma função pura para um inteiro seguro entre 1 e 10.000.

As três superfícies possuem suítes jsdom próprias com Testing Library e `QueryClientProvider`: `buyer-orders-list-ui.test.tsx`, `buyer-order-detail-ui.test.tsx` e `buyer-orders-profile-ui.test.tsx`. Elas cobrem o gate de autenticação, loading, dados reais, vazio, erros, retry, paginação, filtro, dinheiro grande, 404 seguro e ausência das ações mockadas.

## Validação final da PR #38

A PR #38 foi implementada e validada no HEAD `0e741e9d60bd87009e60e27edc43cea89ee1aad4` pelo CI #172 completamente verde. O frontend concluiu 47 arquivos de teste e 493 testes, incluindo os 44 testes específicos desta integração. Backend e infraestrutura também foram integralmente aprovados, incluindo validação, integração real, migrations, PostgreSQL, Redis, MinIO, staging, health checks e smokes.

A integração validada continua exclusivamente de leitura: não adiciona mutações, pagamento, gateway, checkout ou cancelamento real. Nenhum arquivo de backend, Prisma schema ou migration foi alterado. A PR permanece aberta e não foi mesclada.
