# MESSAGING_RULES.md — LIT Buy

Regras futuras de mensagens. **Documentação de planejamento.** Não implementado.

## Tipos de conversa

- **Pré-compra** — comprador em potencial contata vendedor com dúvida sobre produto. Não vinculada a pedido.
- **Pós-compra (vinculada a pedido)** — thread ligada a `order_id`. Usada para entrega, ajustes e suporte.
- **Disputa** — pode ser a mesma thread do pedido, marcada quando disputa é aberta; mensagens viram evidência.

## Participantes

- Conversa **1:1** entre comprador e vendedor.
- Admin pode **visualizar** conversas vinculadas a disputa ou denúncia — nunca participa como membro invisível fora desses casos.
- Nenhum outro usuário tem acesso à conversa.

## Mensagens como evidência

- Mensagens em conversas vinculadas a pedido são **imutáveis** após envio (podem ser marcadas como excluídas para o remetente, mas persistem para auditoria).
- Timestamps do servidor, não do cliente.
- Anexos ficam armazenados com referência à mensagem original.

## Moderação

- Admin pode **ocultar** mensagens que violem termos, mantendo registro para auditoria.
- Denúncia de conversa gera item em `/admin/denuncias`.
- Palavras-chave e detecção automática podem sinalizar mensagens (a definir).

## Anexos futuros

- Imagens, PDFs, arquivos pequenos.
- Armazenamento em Storage privado com Signed URLs de curta duração.
- Verificação de tipo/tamanho no backend.
- Antivírus/scan obrigatório para arquivos maiores.

## Segurança e privacidade

- Conteúdo criptografado em trânsito (HTTPS) e em repouso quando aplicável.
- Nenhum dado pessoal sensível deve ser exigido/coletado em mensagens.
- Alerta ao usuário quando compartilhar dados sensíveis (cartão, senha) — recomendar canais adequados.
- Retenção conforme LGPD / política de privacidade.
- Frontend nunca lista mensagens de conversas às quais o usuário não pertence — mas backend deve garantir o mesmo via RLS.

## Estado atual (mock)

- Não há chat implementado. Rotas de mensagens são placeholders.

## Sprint 18.8 — anti-poaching visual (mock)

- MessageComposer aplica `moderateText()` antes de enviar: contatos externos
  (URLs, e-mails, telefones longos, WhatsApp/Telegram/Discord, @menções) são
  substituídos por `[CONTATO REMOVIDO PELA MODERAÇÃO]`.
- Perguntas públicas (`ProductQuestions`) usam a mesma censura.
- É apenas censura visual em client — moderação real exige backend com filas,
  revisão humana e políticas formais.
- Aviso permanente ao usuário: "Mantenha a conversa dentro da LIT Buy.
  Tentativas de contato externo podem remover a proteção da compra."

## Sprint 18.13 — Detalhe da Venda, Chat do Pedido, Entrega e Mediação (mock)

- Pagamento aprovado (mock) formaliza a criação de uma conversa vinculada ao pedido (`order_related`), acessível em `/pedidos/$id` e em `/mensagens/$id`.
- Chat do pedido é o canal oficial para entrega, suporte e mediação. Conversa fora da plataforma reduz proteção futura.
- Entrega manual e entrega automática são exibidas de forma **visual/mockada** (nunca revelam dados reais). Cofre e criptografia reais exigem backend.
- Central de Mediação (mock) cobre motivos, provas, réplica do vendedor, timeline e trechos do chat como evidência.
- Rota `/vendedor/vendas/$id` mostra a visão do vendedor: comprador, produto, pagamento, entrega, chat, financeiro, timeline e mediação.
- Services: `sellerSaleService`, extensões em `orderService` e `messageService`; nenhum dado é persistido.
- Confirmação de recebimento, liberação de saldo, uploads reais e decisões de mediação **só podem ocorrer no backend real**.

## Sprint 18.14 — Central de Notificações (mock)

- Central visual/mockada: `notificationService` + `NotificationProvider` (`useNotifications`).
- Sino na Navbar (`NotificationBell`): dropdown no desktop, navegação para `/notificacoes` no mobile.
- Rota nova: `/notificacoes` com filtros, contagem de não lidas, marcar como lida / marcar todas / arquivar (tudo em memória).
- Notificações são geradas por papel — comprador, vendedor, admin — e cobrem pedido, pagamento, entrega, chat, mediação, vendas, KYC, denúncias, financeiro e admin.
- Notificações apontam para rotas reais quando existem (`/pedidos/$id`, `/vendedor/vendas/$id`, `/mensagens/$id`, `/admin/*`, `/lit-points`, etc.).
- **Nada é persistido**: sem LocalStorage, sem Cookies, sem backend. Push, e-mail, SMS, WebSocket e Service Worker **não** são implementados — exigem backend real, opt-in do usuário e infra de mensageria.
- Dados sensíveis nunca devem aparecer em notificações — títulos e descrições são genéricos e mascarados.

## Denúncia em mensagens (Sprint 18.15 — mock)

- Toda conversa e mensagem pode ser denunciada via `ReportButton` (`targetType: conversation` ou `message`).
- Tentativa de contato externo é motivo prioritário (`external_contact_attempt` / `external_channels`), severidade alta.
- Mensagens sanitizadas (ex.: `[CONTATO REMOVIDO PELA MODERAÇÃO]`) devem oferecer ação visível de reportar tentativa de contato externo.
- Anti-poaching visual continua ativo. Moderação real exige backend.

## Sprint 18.18 — Chat oficial do pedido
- Conversa vinculada ao pedido é a **conversa oficial** para negociação, suporte e evidência. Renderizada por `OrderChatCard` (comprador) e pela seção equivalente em `SellerSaleDetailView` (vendedor).
- Mensagens automáticas do sistema (`getOrderSystemMessages`) explicam: responsabilidade do vendedor, saldo retido, anti-poaching, entrega automática e Proteção LIT (quando aplicável).
- Mensagem automática do vendedor via LIT-MAX é exibida com badge e passa por `sanitizeExternalContact` antes de renderizar.
- Contato externo continua sendo motivo prioritário para denúncia e pode sugerir mediação também.
- Todo o histórico do chat pode ser usado como evidência em mediação (visualmente). Upload/consolidação real exige backend.

## Sprint 18.19 — Ligação com e-mail

- Uma nova mensagem no chat pode disparar um e-mail transacional (futuro).
- O corpo do e-mail nunca deve conter o texto completo da mensagem sensível;
  apenas o convite para abrir na LIT Buy.
