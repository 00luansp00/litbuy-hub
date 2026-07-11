# DIGITAL_DELIVERY_FLOW.md — LIT Buy

Fluxo futuro de entrega digital. **Documentação de planejamento.** Não implementado.

## Fluxo esperado

1. **Comprador paga.** Gateway confirma via webhook → pedido vai para `paid` → `awaiting_seller_delivery`.
2. **Pedido fica aguardando entrega.** Vendedor recebe notificação.
3. **Vendedor entrega.** Fornece dados, instruções, código, arquivo, link, chave de licença — conforme o tipo do produto.
4. **Comprador confirma recebimento.** Ou não age dentro do prazo, e sistema auto-confirma.
5. **Saldo fica disponível ao vendedor** após a regra de liberação (ver `WALLET_AND_ESCROW_RULES.md`).
6. **Se houver problema**, comprador abre disputa (ver `DISPUTE_FLOW.md`). Saldo fica bloqueado.

## Tipos de entrega previstos

- Arquivo digital (download único ou expirável via Signed URL).
- Chave de licença / código (armazenado cifrado, revelado ao comprador).
- Link privado (documento, curso, mídia).
- Instruções manuais (texto rico).
- Acesso a conteúdo hospedado na própria plataforma.

## Alertas de segurança

- **Dados sensíveis** (chaves, credenciais, arquivos) não devem trafegar sem criptografia em trânsito (HTTPS obrigatório) e devem ser cifrados em repouso quando aplicável.
- **Entrega real precisa de backend.** Frontend nunca deve armazenar o conteúdo entregue.
- **Evidências de entrega devem ser armazenadas** (timestamp, hash do payload, IP, user-agent). Servem para disputa.
- **Logs são obrigatórios** para toda ação de entrega, confirmação, expiração e disputa. Audit trail imutável.
- **Downloads devem ser rastreados** — número de downloads, timestamps, IPs — para detectar abuso.
- **Signed URLs** com expiração curta para arquivos privados. Nunca URLs públicas permanentes.
- **Rate limiting** em endpoints de entrega para prevenir enumeração/scraping.

## Estado atual (mock)

- Não há entrega real. Página de pedido do comprador exibe apenas mock visual.
- Vendedor não tem UI real de entrega — apenas placeholders.
