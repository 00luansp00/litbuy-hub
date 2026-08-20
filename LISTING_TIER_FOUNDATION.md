# Listing Tier Foundation (H1)

## CURRENT IMPLEMENTATION H1

`SILVER`, `GOLD` e `DIAMOND` permanecem identificadores internos estáveis; a UX os apresenta como Prata, Ouro e Diamante. Novos `ListingDraft` começam sem tier e podem ser salvos assim, mas submit, aprovação e materialização falham com `LISTING_TIER_REQUIRED`. Valores legados de drafts são preservados.

`Product.listingTier` é obrigatório e materializado exatamente de `requestedPromotionTier`. A publicação e a purchasability exigem draft aprovado e igualdade entre as duas identidades. A migration faz backfill exclusivamente pela relação `sourceListingDraftId` e aborta se não resolver todos os Products.

No checkout, a única `PLATFORM_COMMISSION` representa H1. O resolver exige policy efetiva única e regra exata para `promotionTier`, cobrada de `SELLER`, exclusivamente `PERCENT_BPS`, sem limites ou qualifiers adicionais. Wildcard não é fallback. O Order preserva os snapshots existentes de policy, regra e valor; o total do Buyer continua sendo o subtotal.

O endpoint autenticado de Seller fornece identidade, label pt-BR, `percentBps` e versão da policy. O wizard não preseleciona tier e deriva a taxa exibida desse read model.

## CURRENT OWNER TARGET

O baseline inicial é Prata 999 bps, Ouro 1199 bps e Diamante 1299 bps. Esses valores pertencem a FeePolicy/FeeRule versionadas (e a fixtures/configuração demo local), nunca ao algoritmo de checkout. Não há seed automático de policy de produção.

## H2 SEPARATE CAPABILITY

Historicamente, H1 não criou snapshot composto, componentes MAX/VIP, refund/reversal por componente, Admin mutation/API/UI, ranking ou benefícios de exposição. H2 foi implementada posteriormente como capability prospectiva separada e materializa somente `LISTING_TIER`; Seller MAX e Buyer VIP permanecem capabilities futuras.
