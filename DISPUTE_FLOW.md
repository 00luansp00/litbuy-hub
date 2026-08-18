# DISPUTE_FLOW.md — LIT Buy

Fluxo futuro de disputa. **Documentação de planejamento.** Não implementado.

> **Nova autoridade OWNER TARGET:** `DISPUTE_FINANCIAL_RECOVERY_CONTRACT.md`. As referências históricas deste arquivo a uma janela temporal para abrir disputa estão **SUPERSEDED FOR TARGET**. “Reportar problema” é vitalício; o prazo de proteção financeira é separado.

## Decisão atual do Owner — label e elegibilidade pública

- O label público da ação é **“Reportar problema”**, não “Disputa”. “Disputa” e “Mediação” permanecem conceitos internos/de domínio.
- No contexto de um Order, “Reportar problema” inicia a disputa/mediação daquele pedido; não é denúncia genérica de usuário, comportamento, anúncio ou moderação.
- O Buyer pode usar a ação depois de o Seller marcar a entrega. Confirmar recebimento não extingue imediatamente esse direito.
- Depois de Seller entregar → Buyer confirmar → Order `COMPLETED`, depois de `releaseEligibleAt` e mesmo depois de proceeds chegarem a `SELLER_AVAILABLE`, a ação continua elegível. Não existe deadline temporal automático de reporting.
- `REPORTING WINDOW != FINANCIAL PROTECTION WINDOW`: `releaseEligibleAt` governa a possível saída de `SELLER_HELD` para `SELLER_AVAILABLE`; não é `disputeDeadline`. Prazos históricos/mock de 15/30/45 dias não são política real.
- A elegibilidade é autoridade server-side; o frontend não decide. A implementação futura exige autenticação, ownership/IDOR, persistência, timestamps server-side, idempotência quando aplicável, auditoria, motivo/descrição, evidências em storage seguro e Admin real.
- Order, Payment, Fulfillment e Dispute permanecem máquinas separadas. Não há rollback automático presumido de `OrderStatus` ao abrir disputa depois de `COMPLETED`; qualquer transição ainda não definida é **`DECISION REQUIRED`**.
- A UI/mock histórica com “Reportar problema” não é implementação real. A rota Buyer real ainda não possui o gatilho funcional.

Uma disputa válida pós-`COMPLETED` não pode ser ignorada apenas porque o Order concluiu. Deve-se preservar o conceito de bloqueio/reserva, mas a política precisa definir o tratamento de proceeds em `SELLER_PENDING`, `SELLER_HELD`, `SELLER_AVAILABLE` e `SELLER_RESERVED`, além do caso em que o valor já avançou para saque/payout. Não se presume solução para dinheiro já pago: **`DECISION REQUIRED / HUMAN-PROD-REVIEW`**. Nenhuma decisão financeira pode ser client-only.

## Status

- **`open`** — comprador acabou de abrir a disputa. Saldo do pedido bloqueado.
- **`waiting_buyer`** — admin ou vendedor solicitou informação/evidência do comprador.
- **`waiting_seller`** — admin ou comprador solicitou resposta/evidência do vendedor.
- **`under_review`** — admin está analisando o caso.
- **`resolved_buyer`** — resolvida a favor do comprador (reembolso total/parcial).
- **`resolved_seller`** — resolvida a favor do vendedor (saldo liberado).
- **`closed`** — encerrada (por acordo, timeout, ou após execução da resolução).

## Quem pode abrir disputa

- **Comprador**, após pedido estar em `awaiting_seller_delivery`, `delivered_by_seller`, `awaiting_buyer_confirmation` ou `completed`, sem expiração automática posterior por tempo. Regras de múltiplos casos/reabertura permanecem `DECISION REQUIRED`.
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

## Efeito financeiro — OWNER TARGET / NOT IMPLEMENTED

- Antes da liberação, uma disputa ativa prevalece sobre a data base/acelerada e mantém proceeds protegidos/reservados. Vitória do Seller antes da data preserva `SELLER_HELD` até a data original; vitória posterior não inicia novo prazo.
- Depois de `SELLER_HELD -> SELLER_AVAILABLE`, reporting continua possível. Vitória do Buyer dispara recovery legítimo, sem presumir dinheiro ainda retido nem prometer refund instantâneo.
- Após decisão definitiva favorável ao Buyer, o target registra obrigação e recovery automaticamente; o faltante deriva em `SELLER_DEFICIT` via Ledger append-only. Claims são segregados e FIFO por Seller; parcial é permitido.
- Valor recuperado só vira futuro saldo sacável do Buyer após autorização humana (`ADMIN` como baseline). Buyer wallet completa, top-up do Seller, engine de recovery e execução PSP são `NOT IMPLEMENTED`.

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
