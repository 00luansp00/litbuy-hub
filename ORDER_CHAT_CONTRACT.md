# LIT Buy — Contrato V1 do chat transacional do pedido

## Finalidade e autoridade

Este documento é a fonte **CURRENT e autoritativa** para a primeira implementação real do chat transacional pós-compra vinculado a `Order`. Ele formaliza uma decisão de produto já autorizada e os limites obrigatórios das futuras PRs de backend, frontend e validação; **não é evidência de que o chat já esteja implementado**.

Em caso de conflito sobre esta V1, este contrato prevalece sobre o planejamento histórico/mock de `MESSAGING_RULES.md`, referências antigas a Supabase/RLS e afirmações das superfícies demonstrativas. `ALPHA_SCOPE_AND_COMPLETION_CHECKLIST.md` continua sendo a autoridade máxima do escopo do Handoff Alpha v1, e os contratos atuais de Order, pagamento, fulfillment e Ledger continuam prevalecendo em seus domínios.

## Status corrente — 2026-08-18

- `AUTHORIZED PRE-HANDOFF COMMERCE INCREMENT`
- `IMPLEMENTATION PENDING`
- `NOT PRODUCTION READY`

O owner autorizou este incremento mínimo antes do Production Handoff. Trata-se de incremento deliberado pós-feature-freeze e pré-handoff: ele não reabre nem altera silenciosamente o Handoff Alpha v1, não muda `PENDENTE DE IMPLEMENTAÇÃO ALPHA = 0`, não declara o Alpha anterior incompleto e não desativa o feature freeze.

Esta autorização não libera dinheiro real, PSP de produção, payout, saque, settlement, refund ou chargeback operacional. O sistema não deve ser chamado de production-ready com base neste contrato.

## Realidade existente

Há UI e integrações visuais de mensagens, incluindo `src/routes/mensagens.tsx`, `src/routes/mensagens.$id.tsx`, componentes de mensagens, `OrderChatCard` e superfícies equivalentes. O `src/services/messageService.ts` é uma camada mockada com seeds/dados em memória: nenhuma mensagem real é enviada, salva ou entregue.

Não existem hoje backend persistente, modelos/constraints do chat, migration, endpoints reais ou validação funcional real desta capability. Esta PR altera somente documentação e não implementa nenhum desses elementos.

## Fluxo funcional V1

`pagamento aprovado` → `Order ACTIVE / PAID` → `chat elegível para Buyer e Seller do Order` → `troca de mensagens` → `Seller registra entrega` → `Buyer confirma recebimento` → `Order COMPLETED` → `chat permanece acessível e utilizável`

O chat é somente um canal de comunicação pós-compra. O lifecycle comercial continua sob as autoridades existentes.

## Escopo obrigatório da V1

1. Somente conversa pós-compra vinculada a um `Order` legitimamente `ACTIVE/PAID` no fluxo atual.
2. No máximo uma conversa canônica por `Order`.
3. Participantes exclusivamente iguais ao Buyer e ao Seller autoritativos daquele `Order`.
4. Texto apenas, persistido no PostgreSQL pela implementação futura.
5. Timestamp autoritativo do servidor.
6. Mensagem imutável após envio, sem edição e sem exclusão física pelo usuário.
7. Histórico disponível depois de `Order COMPLETED`.
8. Buyer e Seller podem continuar lendo e escrevendo após `COMPLETED` nesta V1.
9. APIs REST autenticadas, com polling somente quando necessário, especialmente enquanto a conversa estiver aberta.
10. Histórico paginado por cursor; é proibido desenhar carregamento ilimitado de toda a conversa.
11. Criação/garantia da conversa idempotente e unicidade assegurada por constraint/invariante no backend e no banco, nunca por convenção do frontend.
12. Pedido não pago ou expirado antes da ativação não recebe chat transacional utilizável.

A PR de backend poderá decidir a estratégia exata de materialização da `Conversation`, desde que preserve unicidade por `Order`, idempotência, disponibilidade após ativação, isolamento do fluxo financeiro e ausência de efeito financeiro na criação do chat.

## Fora de escopo da V1

- chat pré-compra ou conversa geral Seller ↔ Buyer sem `Order`;
- chat de suporte e participação ou leitura de conteúdo por Admin/support;
- anexos, uploads, imagens, arquivos, voz, áudio ou vídeo;
- reactions, typing indicators, presença online e read receipts sofisticados;
- WebSocket, realtime, push notification, e-mail de nova mensagem e SMS;
- mensagens automáticas como capability real;
- moderação automática complexa, decisão automática por conteúdo ou sanitização destrutiva server-side;
- denúncia, ocultação, moderation queue, antifraude e enforcement completos;
- mediação/disputa completa e exportação formal de evidência;
- operação financeira ou transição comercial disparada por mensagem;
- regras novas de read-only/locked para disputa, refund ou chargeback.

Estados futuros de disputa, refund ou chargeback poderão mudar a escrita para `read-only`/`locked`, mas essa política será objeto de contrato posterior e não deve ser inventada nesta V1.

## Invariantes de autorização e ownership

- O backend NestJS é a única autoridade de autenticação/autorização do chat; o PostgreSQL persiste o domínio.
- Supabase/RLS não é a arquitetura corrente. Referências históricas a Supabase/RLS são planejamento legado e não devem orientar esta implementação.
- O `Order` é a autoridade para derivar Buyer e Seller. IDs de participantes enviados pelo frontend nunca são aceitos como autoridade.
- Listagem, detalhe, paginação e envio confirmam server-side que o usuário autenticado é o Buyer ou Seller daquele `Order`.
- `conversationId`, `orderId` e qualquer identificador recebido do cliente são não confiáveis. Conhecê-los nunca concede acesso.
- Leitura e escrita devem falhar fechadas contra IDOR, inclusive quando o frontend é manipulado.
- Nenhuma proteção pode depender apenas de esconder botão, link, rota ou conteúdo no frontend.
- Admin/support não é participante, não possui acesso invisível e não recebe autorização ampla “por conveniência” nesta V1.
- As APIs futuras exigem autenticação real, e suas mutations respeitam o boundary vigente de CSRF/session.

## Relação com Order e financeiro

`Order` permanece a autoridade da relação comercial Buyer/Seller. O chat não pode ser uma segunda autoridade do lifecycle e não altera:

- `Order.status`;
- `Payment.status`;
- `fulfillmentStatus`;
- `disputeStatus`;
- Ledger ou qualquer saldo/posting.

Enviar mensagem não libera saldo, não marca entrega, não confirma recebimento e não dispara operação financeira. A criação ou existência do chat não pode tornar pagamento ou ativação financeira dependente do subsistema de mensagens. Falha de materialização ou indisponibilidade do chat não pode causar rollback financeiro incorreto.

`COMPLETED` não encerra automaticamente a conversa: o histórico e a escrita permanecem disponíveis a Buyer e Seller nesta V1.

## Persistência, REST, polling e paginação

A implementação futura persistirá conversa e mensagens no PostgreSQL, com constraint/invariante que impeça mais de uma conversa canônica por `Order`. Criação e replay devem ser idempotentes e não produzir conversa duplicada nem qualquer efeito colateral comercial/financeiro.

O transporte inicial é REST + polling, sem WebSocket/realtime. Polling deve ser contextual, preferencialmente com a conversa aberta, e não um loop global agressivo. A API de histórico deve usar cursor e limite explícito; refresh (`F5`) e nova sessão devem recuperar mensagens persistidas, nunca reconstruí-las de seeds.

## Segurança, privacidade e logging

- Conteúdo de mensagens não deve ser registrado em application logs.
- Tokens, cookies, passwords/senhas, códigos 2FA, recovery codes e secrets nunca devem ser gravados em logs do chat.
- Logs técnicos devem usar somente metadados mínimos e seguros necessários à operação, sem reproduzir conteúdo sensível.
- Autenticação, membership server-side, proteção contra IDOR e boundary CSRF/session são obrigatórios em todas as operações aplicáveis.
- O frontend orienta e apresenta estados, mas nunca determina ownership ou autorização.

## Anti-poaching e limites de moderação

Avisos visuais de segurança podem existir, mas censura/moderação client-side nunca é autoridade de segurança. A lógica mock histórica de contatos externos não deve ser promovida a enforcement real.

Nesta V1, o backend de mensagens preserva o texto conforme enviado dentro do contrato aprovado; não haverá sanitização destrutiva automática server-side. Política final de contato externo, denúncia, ocultação, moderation queue, antifraude e enforcement permanece futura. O planejamento histórico deve ser preservado, sem alegar que essas capabilities já existem.

## Migração futura da UI mock

A futura PR de frontend deve:

- substituir o caminho do chat de `Order` por API real;
- jamais usar o mock como fallback silencioso;
- não misturar conversa real com seeds fictícios;
- exibir loading, empty state real e error/retry coerentes;
- implementar polling contextual e paginação;
- neutralizar ou ocultar controles que aparentem capabilities reais fora desta V1.

Não é necessário remover todo dead code nessa etapa. Cleanup amplo permanece reservado a PR futura isolada.

## Critérios de aceite futuros

Todos os itens permanecem pendentes até as PRs de implementação e validação:

- [ ] A conversa está vinculada ao `Order` correto e é única por constraint/invariante.
- [ ] Somente Buyer e Seller autoritativos leem e enviam mensagens.
- [ ] Troca de IDs comprova proteção contra IDOR entre Buyer A/Buyer B e Seller A/Seller B.
- [ ] Mensagens de texto persistem no PostgreSQL e continuam após `F5`/nova sessão.
- [ ] Buyer e Seller enviam nos dois sentidos, com timestamp do servidor e mensagem imutável.
- [ ] Paginação por cursor funciona sem carregar ilimitadamente todo o histórico.
- [ ] Polling funciona com a conversa aberta e não depende de WebSocket.
- [ ] `COMPLETED` mantém histórico e escrita para Buyer e Seller na V1.
- [ ] Replay/materialização concorrente não duplica conversa, mensagem aceita uma única vez conforme contrato da API, nem efeitos indevidos.
- [ ] Nenhuma mutation do chat altera Order, Payment, fulfillment, dispute ou Ledger.
- [ ] Pedido não pago/expirado antes da ativação não possui chat utilizável.
- [ ] Mocks/seeds não aparecem misturados às conversas reais; ausência real produz empty state real.
- [ ] Conteúdo e secrets não aparecem em application logs.

## Sequência de implementação aprovada

### PR A — esta PR: contrato/documentação

Formaliza a decisão e este contrato. Não implementa chat.

### PR B — futura: backend persistente

Modelos, constraints e migration; service/controller; endpoints REST; ownership/IDOR; paginação; envio; testes backend/integration; nenhuma mudança financeira.

### PR C — futura: frontend real

Adapter/API client; substituição do `messageService` mock no caminho do chat do `Order`; superfícies Buyer e Seller; polling; loading/empty/error; remoção da superfície real de afirmações mock incompatíveis.

### PR D — futura: validação funcional

Buyer e Seller reais no mesmo `Order`; persistência após `F5`; isolamento cruzado; envio nos dois sentidos; paginação; replay; acesso/escrita após `COMPLETED`; prova de ausência de alteração em Order, Payment, fulfillment e Ledger; atualização dos ledgers e da documentação.

## Blockers antes de qualquer alegação de prontidão

Enquanto PR B, PR C e PR D não estiverem implementadas, revisadas e validadas, o chat permanece `IMPLEMENTATION PENDING`. Mesmo depois delas, este contrato sozinho não fecha staging, observabilidade, segurança/hardening, LGPD, retenção, moderação, abuso, backups/restore, performance, operação de produção ou revisão humana sênior.

Nada neste documento torna o sistema production-ready ou autoriza dinheiro real.
