# Integração da Home com o catálogo público

## Objetivo e fronteira

A rota `/` carrega sua única listagem de produtos por `GET /api/v1/catalog/products?sort=RECENT&page=1&limit=8`, sem autenticação, usando o `apiFetch` e `VITE_API_BASE_URL` existentes. O serviço isolado `src/services/publicCatalog/` mantém essa integração real separada do `productService` demonstrativo.

O contrato frontend representa cards, preço discriminado (`FIXED`, `FROM` ou `QUOTE`), taxonomia, vendedor, estoque, imagem e paginação. A resposta entra como `unknown`; o parser valida a raiz, todos os itens, enums, strings obrigatórias, decimal monetário, estoque, relações, URL HTTP(S), expiração e paginação antes de disponibilizar qualquer item. Um contrato inválido gera `MALFORMED_PUBLIC_CATALOG_RESPONSE`, sem conteúdo parcial nem logs da resposta.

## Experiência da Home

As antigas seções “Produtos em destaque”, “Populares agora” e “Chegou agora” foram substituídas por “Anúncios recentes”. O card é somente informativo: não contém link para detalhe, favorito, carrinho, checkout ou alegações de avaliação, vendas, desconto, promoção, reputação ou compra.

- **Loading:** oito skeletons ocupam a futura grade; nenhum produto mockado aparece.
- **Vazio:** é exibida uma mensagem amigável e as demais partes da Home permanecem.
- **Erro:** é exibida uma mensagem segura e uma ação de nova tentativa que invalida a rota; não há fallback mock.
- **Imagens:** somente a URL assinada recebida é usada em memória, com `altText` ou título e fallback local após um único erro. Ela não é persistida, registrada, decomposta nem publicada por proxy.

Hero, estatísticas, benefícios e newsletter permanecem. As categorias da `CategoriesGrid` **continuam mockadas**. A página `/produto/$id`, categoria, busca, loja e todos os fluxos comerciais **continuam mockados/desconectados**; portanto, a visibilidade no catálogo não implica possibilidade de compra.

## Próximos passos

Conectar detalhe público por slug, categorias e busca aos contratos reais; só depois integrar favoritos, carrinho, estoque, checkout, pedidos e pagamentos com regras autoritativas do backend.

## Smoke real e renovação de imagens

O CI executa `bun run smoke:home-catalog` depois do primeiro `demo:seed`/`demo:verify` e antes do reset. O smoke protegido contra produção chama o endpoint com a origem local permitida, confirma HTTP 200 e CORS, passa a resposta HTTP pelo mesmo `parsePublicCatalogListResponse` do frontend, verifica os seis slugs públicos e a ausência dos dois produtos ocultos e de campos privados, e baixa ao menos uma URL assinada sem imprimi-la.

O serviço aceita somente os sorts públicos e limita `page` a 1–100 e `limit` a 1–50 antes da rede. O parser também exige a coerência `NORMAL/FIXED`, `DYNAMIC/FROM` e `SERVICE/FIXED|QUOTE`. Se a rota revalidada entregar uma nova URL assinada ao mesmo card, o estado de falha da URL antiga não se aplica à nova URL, permitindo uma nova tentativa sem persistência, logs ou loop de retry.

## Catálogo público por categoria

A rota `/categoria/$slug` usa produtos e subcategorias públicos reais, com filtros suportados e paginação sem total. Detalhe e comércio continuam desconectados. Consulte `CATEGORY_PUBLIC_CATALOG_INTEGRATION.md`.
