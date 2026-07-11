# LISTING_STATUS_RULES.md — LIT Buy

Regras de status de anúncio (listing/product). **Documentação-alvo.** Hoje o mock usa apenas `active`, `paused`, `draft`, `sold_out`.

## Status

- **`draft`** — rascunho. Só o vendedor vê. Não aparece no catálogo. Não pode ser comprado.
- **`pending_review`** — aguardando moderação (quando categoria/plano exige revisão prévia). Só vendedor + admin veem. Não comprável.
- **`active`** — publicado. Aparece no catálogo e na loja pública. Comprável se `stock > 0`.
- **`paused`** — pausado pelo vendedor. Não aparece no catálogo público. Comprador com link direto vê estado "indisponível". Não comprável.
- **`rejected`** — rejeitado pela moderação. Só vendedor + admin veem, com motivo. Não comprável. Editável para reenvio.
- **`sold_out`** — esgotado. Aparece no catálogo marcado como esgotado. Não comprável. Volta a `active` quando estoque for reposto.
- **`removed`** — removido (pelo vendedor ou pelo admin). Só admin vê para fins de auditoria. Não comprável, não editável.

## Quem pode mudar cada status

| De → Para                     | Vendedor | Admin |
|-------------------------------|----------|-------|
| `draft` → `pending_review`    | ✓        | —     |
| `draft`/`pending_review` → `active` (sem revisão) | ✓ | ✓ |
| `pending_review` → `active`   | —        | ✓     |
| `pending_review` → `rejected` | —        | ✓     |
| `active` → `paused`           | ✓        | ✓     |
| `paused` → `active`           | ✓        | ✓     |
| qualquer → `removed`          | ✓ (próprio) | ✓ |
| `active` ↔ `sold_out`         | sistema (baseado em stock) | — |

## Visibilidade no catálogo

- **Aparecem no catálogo público:** `active`, `sold_out` (marcado como esgotado).
- **Aparecem só para vendedor:** `draft`, `pending_review`, `paused`, `rejected`.
- **Aparecem só para admin:** `removed`.

## Condição de compra (invariante)

Produto só pode ser comprado se:

- `status === 'active'` **E**
- `stock > 0`

Qualquer outra combinação → botão "Comprar"/"Adicionar ao carrinho" desabilitado, com mensagem apropriada. Verificação **também** obrigatória no backend no momento da criação do pedido — nunca confiar só no frontend.

## Relação com o mock atual

- `Product.status` no frontend usa hoje: `active`, `paused`, `draft`, `sold_out`. Faltam: `pending_review`, `rejected`, `removed` — que serão adicionados quando houver moderação real.
- `Product.stock` já é o campo canônico de estoque.
