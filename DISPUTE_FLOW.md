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

## Sprint 18.13 — Detalhe da Venda, Chat do Pedido, Entrega e Mediação (mock)

- Pagamento aprovado (mock) formaliza a criação de uma conversa vinculada ao pedido (`order_related`), acessível em `/pedidos/$id` e em `/mensagens/$id`.
- Chat do pedido é o canal oficial para entrega, suporte e mediação. Conversa fora da plataforma reduz proteção futura.
- Entrega manual e entrega automática são exibidas de forma **visual/mockada** (nunca revelam dados reais). Cofre e criptografia reais exigem backend.
- Central de Mediação (mock) cobre motivos, provas, réplica do vendedor, timeline e trechos do chat como evidência.
- Rota `/vendedor/vendas/$id` mostra a visão do vendedor: comprador, produto, pagamento, entrega, chat, financeiro, timeline e mediação.
- Services: `sellerSaleService`, extensões em `orderService` e `messageService`; nenhum dado é persistido.
- Confirmação de recebimento, liberação de saldo, uploads reais e decisões de mediação **só podem ocorrer no backend real**.

## Denúncia vs Mediação (Sprint 18.15)

- **Mediação**: aberta quando o comprador tem problema com a entrega (não recebido, item diferente, dados inválidos, conta recuperada). Fluxo: `OrderProblemDialog` → `orderService.simulateOpenMediation`.
- **Denúncia**: aberta quando há comportamento irregular (contato externo, golpe, abuso, anúncio enganoso). Fluxo: `ReportDialog` → `reportService.simulateSubmitReport`.
- Uma denúncia pode ser encaminhada para mediação a partir de `/admin/denuncias` (ação mockada).
- Evidências reais (prints, vídeos, mensagens sanitizadas) exigirão storage seguro em produção.

## Sprint 18.18 — Mediação guiada
- **Reportar problema** no chat/pedido abre `OrderProblemDialog` em 3 passos: motivo → descrição (mínimo 10 caracteres, contador visual) → evidências opcionais (mock: print, vídeo, seleção de mensagens do chat).
- Motivos de mediação são separados dos motivos de denúncia (`orderSupportService.MEDIATION_REASONS`).
- Motivos "vendedor pediu contato externo" e "comprador suspeito" mostram sugestão de abrir denúncia paralela.
- Ao abrir mediação, o dialog exibe: prazo da categoria (`getMediationDeadline`) e aviso de saldo do vendedor retido.
- Evidências continuam mockadas: upload real exige storage seguro. Ver `SECURITY_NOTES.md`.
- **Mediação ≠ Denúncia**: mediação resolve o pedido e pode reter saldo; denúncia sinaliza comportamento irregular à moderação.
