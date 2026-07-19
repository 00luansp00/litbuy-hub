# Listing Draft Foundation

## Real nesta sprint

- `ListingDraft` persiste rascunhos por `SellerProfile` ativo, com estados `DRAFT`, `PENDING_REVIEW`, `UNDER_REVIEW`, `REJECTED` e `APPROVED`.
- `ListingDraftVariant`, `ListingDraftAttributeValue`, `ListingDraftServiceDetails` e `ListingDraftAccountDetails` guardam variantes, atributos da taxonomia real e detalhes declarativos.
- Endpoints do vendedor: `GET/POST /api/v1/seller/listing-drafts`, `GET/PATCH /api/v1/seller/listing-drafts/:id`, `POST /api/v1/seller/listing-drafts/:id/submit`.
- Endpoints admin: `GET /api/v1/admin/listing-drafts`, `GET /api/v1/admin/listing-drafts/:id`, `POST /start-review`, `POST /reject`, `POST /approve`.
- Toda atualização, submissão e ação administrativa exige `expectedVersion`; conflito retorna `LISTING_DRAFT_VERSION_CONFLICT` com versão atual e orientação para recarregar.
- Auditoria usa `SecurityEvent` com eventos `LISTING_DRAFT_CREATED`, `LISTING_DRAFT_UPDATED`, `LISTING_DRAFT_SUBMITTED`, `LISTING_DRAFT_REVIEW_STARTED`, `LISTING_DRAFT_REJECTED` e `LISTING_DRAFT_APPROVED` sem gravar descrições completas, credenciais, headers, tokens ou cofre.
- A taxonomia persistente é reutilizada; categoria, subcategoria, `CatalogProductType` e atributos são revalidados ao salvar, submeter e aprovar.

## Demonstrativo ou futuro

- `APPROVED` significa apenas aprovação de moderação. Não cria produto público, slug, página pública, estoque comprável, busca, carrinho, pedido ou checkout.
- Imagens seguem como previews locais; não há upload/storage e object URLs ou IDs locais não são enviados à API.
- Entrega automática pode ser salva como preferência, mas submissão retorna `LISTING_AUTOMATIC_DELIVERY_UNAVAILABLE`.
- Cofre, credenciais, códigos, KYC, pagamentos, planos pagos e cobrança de destaque não foram implementados.
