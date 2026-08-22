# Integração do detalhe com o catálogo público

## Objetivo e rota

`/produto/$id` consulta exclusivamente `GET /api/v1/catalog/products/:slug`. O nome legado `$id` foi mantido porque ainda há referências tipadas a essa rota, mas seu valor é sempre o **slug público**; renomeá-lo fica para uma mudança coordenada posterior.

## Contrato e validação

O serviço `publicCatalogService.detail` valida o slug antes da rede, faz a chamada sem autenticação e entrega a resposta `unknown` ao parser defensivo compartilhado com os cards. O detalhe contém os campos públicos comuns, descrição, `MANUAL`/`AUTOMATIC`, variantes, galeria e detalhes discriminados de serviço. Contratos incoerentes produzem `MALFORMED_PUBLIC_CATALOG_RESPONSE`.

`NORMAL` usa preço fixo; `DYNAMIC` usa “a partir de” e exige variantes; `SERVICE` aceita preço fixo ou orçamento e exige `serviceDetails` coerente. Variantes são informativas e mantêm a ordem da API. A galeria usa apenas URLs HTTP(S) assinadas recebidas, exige uma única capa correspondente a `coverImage` e nunca deriva ou persiste URLs. Falhas de imagem ficam associadas à URL, permitindo nova tentativa quando a revalidação fornecer outra URL.

## Interface e segurança

A página mostra breadcrumb, descrição real, categoria/subcategoria, estoque aplicável, modo de entrega informado, `storeName`, slug e o estado textual derivado exclusivamente de `SellerProfile.verified`. Não há link para loja, reputação, detalhes de KYC, avaliações, perguntas, relacionados ou denúncia. `AUTOMATIC` não implica que o fluxo comercial esteja ativo.

Slug inválido e `404 PRODUCT_NOT_FOUND` usam a mesma mensagem pública. Rede, HTTP 5xx e contrato inválido mostram erro seguro com revalidação por “Tentar novamente”; o loading usa skeleton próprio e nunca recorre a mocks. Cards do catálogo público navegam pelo slug. O `ProductCard` legado e superfícies mockadas (busca, loja e fluxos antigos) não navegam automaticamente ao detalhe real.

## Smoke e limitações

`bun run smoke:product-detail-catalog` verifica seis anúncios demo, os três casos indistinguíveis de 404, ausência de campos privados e download de uma imagem assinada. Home e categoria mantêm seus smokes. Compra, reserva de estoque, pagamentos, comunicação, loja pública, avaliações, perguntas e relacionados permanecem fora de escopo.
