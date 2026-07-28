# Product lifecycle foundation

> Public catalog reads reuse the lifecycle pure publication eligibility evaluation. Lifecycle transitions and their error codes remain unchanged.

## Estado autoritativo

O backend NestJS/PostgreSQL passa a persistir o ciclo de vida dos produtos materializados. `ACTIVE` é agora um estado real no banco, mas **não** significa exposição no catálogo público: ainda não existe leitura pública conectada, compra, reserva de estoque ou pagamento.

## Endpoint e autorização

`PATCH /api/v1/seller/products/:productId/lifecycle` recebe somente `{ action, expectedVersion }`, com `action` em `ACTIVATE | PAUSE | RESUME | REMOVE` e versão inteira positiva. O controller exige access token e papel persistente `SELLER`; o serviço exige `SellerProfile` `ACTIVE` e filtra o produto simultaneamente por ID e proprietário, devolvendo `PRODUCT_NOT_FOUND` para inexistência e IDOR. O CSRF global continua protegendo o método inseguro.

## Máquina de estados

- `UNPUBLISHED -> ACTIVE` (`ACTIVATE`)
- `ACTIVE -> PAUSED` (`PAUSE`)
- `PAUSED -> ACTIVE` (`RESUME`)
- `UNPUBLISHED | ACTIVE | PAUSED -> REMOVED` (`REMOVE`)
- `REMOVED` é terminal.

Retries cujo resultado já está persistido retornam `changed: false`, sem versão ou auditoria nova. Demais transições inválidas são determinísticas.

## Elegibilidade

Ativação e retomada revalidam, dentro da transação: vendedor ativo; rascunho de origem ainda `APPROVED`; categoria/subcategoria ativas e relacionadas; conteúdo e slug; exatamente uma capa `READY`; e coerência de variantes, preço e estoque para `NORMAL`, `DYNAMIC` e serviços `FIXED`. Serviço `QUOTE` é válido sem preço e sem variante fictícia.

Os IDs de categoria e subcategoria e o tipo do produto também devem permanecer iguais aos do rascunho aprovado; divergências retornam `PRODUCT_TAXONOMY_MISMATCH`. A variante única de produto `NORMAL` e serviço `FIXED` deve permanecer `ACTIVE`.

## Concorrência, versão e auditoria

A transação adquire `pg_advisory_xact_lock(hashtext('product-lifecycle:' || productId))`, relê todo o agregado, verifica `expectedVersion` e usa update condicional. Uma mudança incrementa a versão exatamente uma vez. Conflitos retornam HTTP 409 com `PRODUCT_VERSION_CONFLICT`.

Mudanças reais escrevem exatamente um evento sanitizado: `PRODUCT_ACTIVATED`, `PRODUCT_PAUSED`, `PRODUCT_RESUMED` ou `PRODUCT_REMOVED`. Metadados contêm apenas IDs, ator, ação, estados e versões; não contêm `objectKey`, URL assinada, token, cookie, header ou conteúdo do produto.

## Frontend interno

`ProductLifecycleManager` consulta o produto real, apresenta status/versão, oferece somente ações coerentes, confirma remoção, bloqueia clique duplo e relê o backend após sucesso ou conflito. O parser valida UUID v4, slug, status, versão, ISO e `changed`. Não existe fallback mock nem persistência em storage/URL.

## Limitações e futuro

Não há mutação administrativa, catálogo público, busca, compra, estoque/reserva transacional, carrinho, checkout, pedidos ou pagamentos. O futuro catálogo poderá usar `ACTIVE` como um dos critérios de visibilidade, sem dispensar suas próprias regras de disponibilidade e segurança.
