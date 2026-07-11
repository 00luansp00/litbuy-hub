# DISPUTE_FLOW.md — LIT Buy

Fluxo futuro de disputa. **Documentação de planejamento.** Não implementado.

## Status

- **`open`** — comprador acabou de abrir a disputa. Saldo do pedido bloqueado.
- **`waiting_buyer`** — admin ou vendedor solicitou informação/evidência do comprador.
- **`waiting_seller`** — admin ou comprador solicitou resposta/evidência do vendedor.
- **`under_review`** — admin está analisando o caso.
- **`resolved_buyer`** — resolvida a favor do comprador (reembolso total/parcial).
- **`resolved_seller`** — resolvida a favor do vendedor (saldo liberado).
- **`closed`** — encerrada (por acordo, timeout, ou após execução da resolução).

## Quem pode abrir disputa

- **Comprador**, após pedido estar em `awaiting_seller_delivery`, `delivered_by_seller`, `awaiting_buyer_confirmation` ou dentro de janela pós-`completed` definida pela política.
- Não pode ser aberta antes de `paid` (não há valor em escrow).

## Evidências

- Texto descritivo.
- Anexos (screenshots, arquivos, prints da conversa).
- Referência a mensagens da conversa vinculada ao pedido (ver `MESSAGING_RULES.md`).
- Log automático de entrega (do lado do sistema).
- Logs de acesso/download quando aplicável.

## Participação do admin

- Admin visualiza toda a disputa, evidências, mensagens e histórico.
- Admin pode solicitar mais informação (transiciona para `waiting_buyer` ou `waiting_seller`).
- Admin decide desfecho: `resolved_buyer` ou `resolved_seller`, com valor de reembolso quando parcial.
- Toda ação do admin em disputa gera **audit log**.

## Efeito no saldo

- Ao abrir disputa: **saldo do pedido bloqueado** na carteira do vendedor (mesmo se já estava "pendente" ou "disponível").
- `resolved_buyer` → reembolso ao comprador via gateway. Saldo do vendedor **não** é liberado.
- `resolved_seller` → saldo do vendedor volta ao ciclo normal de liberação.
- Reembolso parcial: valor devolvido ao comprador, restante liberado ao vendedor.

## Quando vendedor recebe

- Apenas após `resolved_seller` ou `closed` sem reembolso, respeitando o ciclo de liberação (ver `WALLET_AND_ESCROW_RULES.md`).

## Regras

- Disputa **não** é implementada como ação real no frontend. Nenhuma decisão financeira parte do cliente.
- Estado atual: apenas visual/mock em `/admin/disputas` e telas de vendedor.
