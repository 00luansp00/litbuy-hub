# REVIEW_RULES.md — LIT Buy

Regras futuras de avaliação. **Documentação de planejamento.** Não implementado.

## Regras

- **Comprador só pode avaliar após pedido `completed`.** Sem pedido concluído → sem avaliação.
- Cada avaliação está vinculada a um **`order_item`** específico — não a um produto/vendedor de forma livre. Isso previne:
  - avaliação sem compra;
  - múltiplas avaliações do mesmo comprador para o mesmo produto sem novas compras;
  - avaliação por conta que nunca interagiu com o vendedor.
- **Vendedor pode responder** à avaliação (uma resposta por avaliação, editável dentro de janela definida).
- **Admin pode moderar** — ocultar, remover ou marcar como suspeita. Toda ação em audit log.
- **Avaliação falsa** deve ser prevenida por:
  - vínculo obrigatório a `order_item` real;
  - rate limiting;
  - detecção de padrões suspeitos (mesmo IP, mesma conta em massa, etc.);
  - denúncia por outros usuários.
- **Reputação do vendedor** = média ponderada das notas + volume + recência. Cálculo no backend, exibido no frontend.
- Comprador pode **editar** a própria avaliação dentro de janela; após isso, imutável.

## Campos previstos

- `order_item_id` (FK, obrigatório e único por avaliação)
- `buyer_id` (derivado do pedido, não do formulário)
- `product_id` / `seller_id` (derivados do `order_item`)
- `rating` (1–5)
- `title` (opcional)
- `body`
- `seller_response` (opcional)
- `status` (`visible`, `hidden`, `flagged`, `removed`)
- `created_at`, `updated_at`

## Estado atual (mock)

- Notas exibidas em `ProductCard` e `SellerInfo` são estáticas.
- Nenhuma avaliação real é criada, editada ou moderada.
