# Threat model comercial

**Status: controles obrigatórios para implementação futura.** Fonte: `COMMERCE_ARCHITECTURE.md`. Cada linha exige controle preventivo, detecção e teste antes da fase correspondente.

| Ameaça                            | Impacto                  | Controle preventivo                            | Controle detectivo          | Teste obrigatório                 |
| --------------------------------- | ------------------------ | ---------------------------------------------- | --------------------------- | --------------------------------- |
| Manipulação de preço              | perda financeira         | recalcular server-side, ignorar valor cliente  | divergência auditada        | payload com preço adulterado      |
| Quantidade negativa/excessiva     | estoque/saldo incorreto  | inteiro positivo, limites e schema             | métricas de rejeição        | limites, zero, negativo, overflow |
| Produto pausado no checkout       | venda indevida           | revalidar publicação na transação              | evento de conflito          | pausa concorrente                 |
| Corrida de estoque                | overselling              | update condicional atômico                     | estoque/reserva invariantes | duas compras concorrentes         |
| Pedido duplicado                  | cobrança/reserva dupla   | idempotência transacional                      | correlação duplicada        | retries após timeout              |
| Webhook duplicado                 | efeito financeiro duplo  | unique provider event ID                       | contador de dedupe          | mesma entrega repetida            |
| Webhook falso                     | fraude                   | assinatura e origem contratual                 | alerta de assinatura        | assinatura inválida               |
| Replay                            | repetição tardia         | timestamp/tolerância + ID único                | alerta de replay            | evento antigo reutilizado         |
| Mudança de seller                 | desvio                   | seller carregado do catálogo e carrinho único  | mismatch auditado           | seller adulterado                 |
| IDOR em carrinho/pedido           | vazamento/alteração      | autorização por owner em toda consulta         | tentativas negadas          | usuário B acessa A                |
| Enumeração de códigos             | privacidade              | código opaco e resposta uniforme               | rate/404 anômalo            | varredura sequencial              |
| Reembolso duplicado               | perda                    | chave + limite agregado transacional           | total refunded reconciliado | retries simultâneos               |
| Chargeback após saque             | saldo negativo           | reserva/hold e política de risco               | exposição por seller        | chargeback pós-withdrawal         |
| Saldo negativo                    | perda/insolvência        | limites e lançamentos balanceados              | monitor de conta negativa   | reversão maior que disponível     |
| Alteração de snapshot             | disputa/fraude           | imutabilidade e acesso restrito                | hash/evento de integridade  | tentativa de update               |
| Vazamento de credenciais digitais | tomada de ativo          | segredo fora do snapshot/log, entrega restrita | acesso anômalo              | inspeção de resposta/log          |
| Abuso de serviço QUOTE            | bypass comercial         | bloquear carrinho com `PRODUCT_REQUIRES_QUOTE` | métrica de tentativas       | add/checkout QUOTE                |
| Logs financeiros                  | exposição LGPD/segredo   | allowlist e redaction                          | scanner de logs             | payload sensível não aparece      |
| Falha gateway-banco               | estado divergente        | outbox/idempotência, commit antes de efeito    | reconciliação               | falha em cada boundary            |
| Job de expiração duplicado        | liberação dupla          | operação idempotente/lock lógico               | evento duplicado            | dois workers no mesmo pedido      |
| Redis parcialmente indisponível   | bypass/indisponibilidade | banco como autoridade, fail-safe               | health/latência             | perda do Redis no checkout        |
| Rollback incompleto               | estoque/pedido órfão     | transação única e compensação externa          | invariantes e reconciliação | fault injection por etapa         |
