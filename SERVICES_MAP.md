# Mapa atual de services

O projeto é híbrido. Services reais e legados demonstrativos coexistem; o backend é a fonte de verdade das superfícies integradas.

## `publicCatalogService` — real e somente leitura

`src/services/publicCatalog/` é consumido por `/`, `/categoria/$slug` e `/produto/$id`.

- **Listagem:** Home solicita anúncios públicos recentes.
- **Categoria:** listagem real com filtro de categoria/subcategoria, ordenação e paginação.
- **Detalhe:** consulta real por slug na rota legada `/produto/$id`.
- **Defesa:** respostas `unknown` passam por parsers defensivos antes de chegar à UI.
- **Imagens:** objetos privados são apresentados por URLs assinadas temporárias.
- **Limite:** leitura pública não habilita carrinho, reserva, compra, checkout, avaliações ou qualquer mutação comercial.

## `productService` — legado demonstrativo

`src/services/productService.ts` ainda lê `src/data/products.ts`. Seus consumidores reais no código são busca, loja, favoritos, perfil e componentes legados como carrinho, checkout, cards e grids demonstrativos. Ele **não** abastece Home, `/categoria/$slug` nem `/produto/$id`.

## Outros services demonstrativos

- `sellerService`, `reviewService` e `questionService`: loja/seller, avaliações e perguntas.
- `cartService`, `checkoutService`, `paymentService` e `orderService`: comércio visual sem transação real.
- `messageService`, seller/admin services, afiliados, notificações, KYC e conteúdo: superfícies legadas documentadas em `MOCKS_INVENTORY.md`.

## Services reais adicionais

Autenticação usa os módulos em `src/services/auth/` e a API NestJS. Lifecycle persistente, catálogo e imagens estão documentados nas auditorias próprias. Nenhum service frontend deve ser tratado como autoridade para dinheiro, permissão, estoque ou publicação.

# Atualização — buyer orders

`src/services/orders` é o módulo real e isolado de leitura de pedidos: tipos, parser defensivo, formatação BRL com `BigInt`, service autenticado e queries TanStack. `src/services/orderService.ts` permanece apenas legado e não é importado pelas rotas reais.

`orderCode.ts` é a fonte única do regex público e `buyerOrdersService.detail` rejeita respostas cujo código difira do solicitado com `MALFORMED_RESPONSE`. Falhas locais de parsing/validação não recebem retry automático; 401/403/404 também não.
