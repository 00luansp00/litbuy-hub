# Seller MAX Listing — CURRENT I1

## Escopo implementado

`ListingDraft.requestedSellerPlan` é a escolha server-side por anúncio (`STANDARD` ou
`LIT_MAX`). A aprovação materializa o mesmo enum em `Product.sellerPlan`; a regra de publicação
também exige que Product e Draft coincidam.

Durante o checkout single-SKU, o backend lê `Product.sellerPlan` e grava no mesmo transaction o
snapshot comercial não monetário do Order:

- `commercialSnapshotVersion = 1`;
- `sellerPlanSnapshot = STANDARD | LIT_MAX`.

Replay concluído retorna o response persistido pela idempotency record antes de consultar carrinho
ou Product. Portanto, mudança posterior do Product afeta somente compras futuras.

## Legado e invariants

Produtos anteriores a I1 recebem `STANDARD`, pois antes desta capability não havia evidência
autoritativa de MAX no Product. Isso é conservador e não inventa histórico MAX. Orders anteriores
permanecem com ambos os campos comerciais `NULL`; `NULL/NULL` significa snapshot legacy, não
STANDARD inferido.

Uma constraint permite somente `NULL/NULL` (legacy) ou versão `1` com enum presente. Trigger
PostgreSQL impede UPDATE dos dois campos depois da criação do Order. O enum do banco impede labels
ou valores arbitrários.

## Limites

I1 não cria fee Seller MAX, não altera cobrança do Buyer, listing-tier fee, release, janela de 48h,
LP, estoque ou mensagens. O snapshot é identidade comercial, separado do fee snapshot H2.
