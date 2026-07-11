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
