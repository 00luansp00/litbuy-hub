# WALLET_AND_ESCROW_RULES.md — LIT Buy

Regras futuras de saldo, carteira e intermediação. **Documentação de planejamento.** Nenhum cálculo real existe hoje.

## Composição do valor

- **Valor bruto da venda** — total pago pelo comprador (produto + eventuais adicionais).
- **Taxa da plataforma** — percentual + fixo, definido no backend, por vendedor/categoria/plano.
- **Valor líquido do vendedor** = bruto − taxa − eventuais estornos/ajustes.

## Estados de saldo do vendedor

- **Saldo pendente** — valor de pedidos ainda não liberados (aguardando confirmação, dentro de janela pós-venda, ou em disputa).
- **Saldo disponível** — valor liberado, pronto para saque.
- **Saldo bloqueado** — valor retido por disputa ou análise de risco.

## Ciclo de liberação

1. Pedido `completed` → valor entra em **pendente**.
2. Após período de segurança (ex.: X dias sem disputa) → valor migra para **disponível**.
3. Se disputa é aberta durante o período → valor migra para **bloqueado** até resolução.

## Saque

- Vendedor solicita saque a partir do saldo **disponível**.
- Saque exige método de pagamento verificado (KYC pode ser requerido conforme valor).
- Processado pelo backend via gateway/PSP. Frontend apenas exibe status.

## Estorno / reembolso

- `refunded` (parcial ou total) → valor devolvido ao comprador via gateway.
- Se vendedor já sacou → débito futuro ou cobrança conforme política.

## Regras invioláveis

- **Nenhum cálculo financeiro final pode ficar apenas no frontend.** UI exibe valores fornecidos pelo backend.
- **Backend é responsável** por: cálculo de taxa, líquido, agregação de saldo, elegibilidade de saque, aplicação de estornos, bloqueio por disputa.
- **Gateway de pagamento** deve ser integrado de forma profissional: webhooks assinados e verificados, idempotência, reconciliação diária, logs de todas as transições.
- **Toda movimentação** gera entrada em `wallet_transactions` (ledger imutável).
- Frontend nunca envia valor de preço no checkout — apenas `product_id` + `quantity`. Backend recalcula.

## Estado atual (mock)

- `/vendedor/financeiro` e `/admin/transacoes` exibem valores mockados.
- Nenhum saque, estorno ou movimentação real ocorre.

## Sprint 18.9 — Saldo LIT e LIT Points no checkout (mock)

- Saldo LIT no checkout é apenas visual (`getMockWalletBalance`); nenhum
  débito ocorre.
- LIT Points no checkout usam cotação demonstrativa (1 ponto ≈ R$ 0,02)
  e nenhum ponto real é debitado.
- Integração real exige carteira, ledger e regras de expiração/cotação
  definidas pelo backend.

## Sprint 18.10 — LIT Points, Tarifas, Prazos e Níveis de Vendedor

- Programa LIT Points é próprio da LIT Buy. Não é dinheiro, não é saldo financeiro, não pode ser sacado.
- Rotas públicas `/lit-points` e `/taxas` explicam programa, tarifas, prazos e níveis de vendedor.
- Níveis Bronze/Prata/Ouro/Diamante/Elite são visuais e mockados.
- Taxas e prazos exibidos são demonstrativos. Cálculo real, cobrança, split, escrow, saques e assinatura LIT-MAX exigem backend.
- Saldo LIT é separado de LIT Points. Saldo pendente/disponível/bloqueado é apenas visual.
- Services: `litPointsService`, `sellerLevelService`, `platformEconomicsService` — todos mockados, sem persistência.
- Integrações leves em `/carteira`, `/vendedor`, `/vendedor/financeiro`, `/loja/$slug` e `/produto/$id`.
- Footer aponta para `/lit-points` e `/taxas`.
