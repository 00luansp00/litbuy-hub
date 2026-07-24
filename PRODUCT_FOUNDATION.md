# Product Foundation

## Real nesta sprint

- A aprovação administrativa de `ListingDraft` agora materializa um `Product` comercial persistente na mesma transação PostgreSQL quando o rascunho ainda não estava aprovado.
- Todo produto nasce com `ProductStatus.UNPUBLISHED`; esta tarefa não publica catálogo público e não torna produto comprável.
- `Product.sourceListingDraftId` é obrigatório e único, tornando o rascunho aprovado a origem auditável de no máximo um produto.
- A materialização copia dados comerciais aprovados para tabelas próprias de produto: vendedor, taxonomia, tipo, modelo, título, descrição, entrega, preço/estoque aplicáveis, variantes, atributos, detalhes de serviço e declarações de conta sem credenciais.
- Slugs são gerados no backend a partir do título, normalizados e protegidos por `UNIQUE`; em colisões usam sufixo estável derivado do rascunho.
- Idempotência: retries retornam o produto existente; a constraint única de `sourceListingDraftId` é a barreira final contra corridas.
- Rascunhos antigos já `APPROVED` sem produto podem ser reconciliados por nova aprovação administrativa após revalidação; isso cria no máximo um produto `UNPUBLISHED` e audita `PRODUCT_MATERIALIZED` com modo `reconciliation`.
- Endpoints internos protegidos: `GET /api/v1/seller/products`, `GET /api/v1/seller/products/:id`, `GET /api/v1/admin/products`, `GET /api/v1/admin/products/:id`.
- Variantes: `NORMAL` gera variante padrão; `DYNAMIC` copia todas as variantes e mantém pausadas como `PAUSED`; `SERVICE/FIXED` gera variante padrão futura; `SERVICE/QUOTE` não cria variante comprável fictícia.

## Futuro ou demonstrativo

Imagens, storage, upload, publicação, catálogo público, busca, carrinho, estoque reservado, pedidos, pagamentos, promoções, LIT-MAX, reviews, reputação, KYC, entrega automática, cofre e edição completa de produto publicado permanecem fora do escopo.
