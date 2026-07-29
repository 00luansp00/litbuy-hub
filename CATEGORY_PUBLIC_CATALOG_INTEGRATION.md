# Integração do catálogo público na categoria

A rota `/categoria/$slug` lê categoria, subcategorias ativas e anúncios em `GET /catalog/categories/:slug`, `GET /catalog/categories/:slug/subcategories` e `GET /catalog/products`.

## Estado e contrato

A URL mantém `subcategory`, `productType`, `sort` (`RECENT`, `OLDEST`, `TITLE_ASC`, `TITLE_DESC`) e `page`; o `limit` é sempre 12. `categorySlug` vem da rota. Slugs, tipos, ordenação e página inválidos são normalizados, e uma subcategoria de outra categoria é removida antes da consulta. Não há total: a interface informa apenas quantos itens a página exibe e usa `hasNext`.

Os únicos filtros são subcategoria e tipo público (conta, moeda virtual, gift card, chave, skin, item, serviço, assinatura, jogo, software e outro). Preço, entrega, região, plataforma, vendedor, avaliação, vendas e promoções foram removidos desta página.

## Estados da interface

O carregamento preserva espaço para hero, controles e até 12 cards. O vazio distingue categoria sem anúncios de filtros sem resultados e permite limpar filtros. Falhas de subcategorias ou produtos preservam a categoria e oferecem retry sem revelar detalhes técnicos ou recorrer a mocks.

Os cards reutilizam imagens assinadas e fallback, preço, estoque, categoria, subcategoria, loja, tipo e modelo reais. São informativos: detalhe de produto permanece mockado e não há link, compra, carrinho, favorito, checkout ou avaliação.

## Smoke

`bun run smoke:category-catalog` usa o parser do frontend, valida HTTP/CORS, categorias do dataset, subcategoria, tipo, quatro ordenações, paginação determinística e ausência de produtos ocultos. O smoke da Home permanece independente.
