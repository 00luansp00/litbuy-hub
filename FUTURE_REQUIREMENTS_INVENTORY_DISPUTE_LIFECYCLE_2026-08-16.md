# LIT Buy — Requisitos futuros de lifecycle de inventário, disputa e encerramento de pedido

Data de registro: 2026-08-16

## Finalidade

Este documento registra regras de negócio que devem permanecer rastreáveis para as fases futuras de implementação, auditoria, productionização e testes do LIT Buy.

Ele **não** declara que disputa financeira completa, refund, chargeback, chat pós-disputa ou reviews já estejam implementados. Ele também não autoriza Phase B, dinheiro real, PSP real ou alteração imediata das state machines atuais.

Quando algum ponto abaixo já existir no backend atual, ele é tratado como **invariante a preservar e revalidar**, e não como nova implementação.

---

# 1. Inventário durante os 15 minutos do pedido — comportamento atual a preservar

## 1.1 Regra de negócio

Ao gerar um pedido de um item com estoque controlado, a quantidade daquele pedido deve ficar indisponível para novas compras durante a janela de pagamento.

No Alpha atual, a janela padrão é de **15 minutos**.

Importante: tecnicamente, o backend atual não decrementa imediatamente o campo persistido de estoque no momento da criação do pedido. Em vez disso:

1. o checkout cria uma `InventoryReservation` `ACTIVE` com a quantidade do pedido;
2. a reserva recebe o mesmo deadline do pedido (`expiresAt`);
3. a disponibilidade efetiva é calculada descontando as reservas `ACTIVE` válidas do estoque persistido;
4. portanto, para outro comprador, aquela quantidade já fica indisponível durante a reserva, mesmo antes do pagamento;
5. o TTL padrão é `15` minutos, configurável por `CHECKOUT_RESERVATION_TTL_MINUTES`.

Essa distinção deve ser preservada na documentação e nos testes:

> **reserva de disponibilidade não é a mesma coisa que decremento definitivo do campo de estoque.**

## 1.2 Pedido não pago dentro da janela

Se o comprador não efetuar o pagamento válido dentro da janela:

- o pedido deve deixar de ser elegível para pagamento;
- o processamento de expiração deve levar o pedido para `EXPIRED`;
- a `InventoryReservation` `ACTIVE` deve deixar de bloquear disponibilidade e passar para estado de expiração/liberação;
- a mesma quantidade volta a ficar disponível para uma nova compra;
- o pedido antigo não deve ser reutilizado para uma nova tentativa de compra;
- se o comprador ainda quiser comprar, deverá gerar **outro pedido**, sujeito novamente ao estoque disponível naquele momento.

No desenho atual, como o estoque persistido ainda não havia sido decrementado, a expiração **não deve incrementar o campo de estoque**. Ela apenas libera a reserva. Incrementar estoque nessa etapa criaria estoque artificial.

## 1.3 Pedido pago dentro da janela

Se o pagamento válido for confirmado dentro da janela:

- a reserva precisa continuar válida até a ativação;
- a quantidade da reserva deve ser consumida **exatamente uma vez**;
- o estoque persistido do `Product` ou `ProductVariant`, conforme o modelo, deve ser decrementado pela quantidade comprada;
- a reserva deve passar para `CONSUMED`;
- replay de pagamento, reconciliação ou ativação não pode baixar o estoque novamente.

Esse comportamento já existe como foundation atual e deve continuar sendo revalidado nos testes futuros.

---

# 2. Disputa vencida pelo comprador — requisito futuro obrigatório

A resolução completa de disputa/refund/chargeback está fora do Alpha atual e deve ser tratada como capability futura/productionização. Quando esse domínio for implementado, a seguinte regra deve ser considerada requisito explícito.

## 2.1 Resultado de negócio

Quando uma disputa de um pedido pago for encerrada definitivamente **a favor do comprador**:

- o pedido deve entrar em um estado terminal coerente com a resolução da disputa;
- o comprador deve receber o resultado financeiro devido conforme a política de refund/reversal vigente;
- o Seller não deve manter proceeds indevidos daquela venda;
- os efeitos financeiros devem ser reconciliados no Ledger de forma balanceada e idempotente;
- a quantidade de inventário consumida por aquele pedido deve ser restaurada quando o item possuir estoque controlado e for elegível para retorno ao inventário;
- a restauração deve ocorrer **exatamente uma vez**, mesmo se a decisão, webhook, worker ou comando for processado novamente.

Para itens sem estoque, como serviços, a regra de reposição não se aplica.

Para ativos digitais únicos, credenciais, contas ou itens cuja entrega possa ter comprometido a reutilização segura do ativo, a implementação futura deve definir explicitamente a elegibilidade de retorno antes de recolocar o item à venda. O objetivo permanece impedir perda indevida de estoque, sem criar risco de revenda de um ativo que ainda possa estar nas mãos do comprador.

## 2.2 Encerramento de contato entre comprador e vendedor

Após a decisão final a favor do comprador:

- o chat vinculado **àquele pedido** deve ser encerrado para novas mensagens entre Buyer e Seller;
- o histórico não deve ser apagado silenciosamente, pois pode ser necessário para auditoria, suporte, segurança, contestação e compliance;
- Buyer e Seller não devem continuar usando o chat daquele pedido como canal de contato após o encerramento;
- Admin/suporte pode manter acesso conforme a futura política de auditoria e retenção.

Esta regra refere-se ao canal daquele pedido. Ela não implica automaticamente bloqueio global entre as duas contas em todo o marketplace, salvo decisão futura específica.

## 2.3 Avaliação/review

Após uma disputa encerrada definitivamente a favor do comprador:

- não deve ser possível criar nova avaliação/review vinculada àquela transação;
- a UI não deve convidar Buyer ou Seller a avaliar o pedido encerrado por disputa;
- o backend deve impor essa regra, não apenas ocultar botão no frontend;
- o tratamento de uma avaliação eventualmente criada **antes** da abertura/resolução da disputa deverá ser decidido explicitamente na política futura; não apagar ou reescrever histórico sem regra documentada.

---

# 3. Restauração de estoque após disputa Buyer-win

Quando aplicável a item com estoque controlado e elegível para retorno:

1. localizar a quantidade efetivamente consumida pelo pedido;
2. usar os snapshots/reservas do próprio pedido como autoridade, e não valores enviados pelo frontend;
3. restaurar exatamente essa quantidade no `Product` ou `ProductVariant` correto;
4. persistir um evento/audit trail de restauração de inventário;
5. usar uma chave/idempotência vinculada à resolução do pedido/disputa para impedir incremento duplicado;
6. replay da mesma resolução deve ser no-op seguro;
7. Seller-win, disputa rejeitada ou resolução que não devolva o item ao Buyer **não pode** acionar a mesma reposição automaticamente;
8. a restauração de estoque deve permanecer consistente com refund/reversal, Ledger e estado terminal do pedido.

Nunca calcular reposição a partir de quantidade atual do carrinho ou de payload controlado pelo cliente.

---

# 4. Casos de teste obrigatórios futuros

## 4.1 Reserva e expiração sem pagamento

- criar pedido de quantidade `N`;
- comprovar que a disponibilidade efetiva cai em `N` imediatamente pela reserva;
- comprovar que o estoque persistido ainda não foi decrementado antes do pagamento;
- durante a janela válida, outro checkout não pode consumir a quantidade reservada além do disponível;
- após o deadline e processamento de expiração, a reserva deixa de bloquear estoque;
- comprovar que a quantidade volta a ficar comprável;
- comprovar que o pedido antigo não aceita pagamento tardio;
- replay do processador de expiração não altera estoque uma segunda vez.

## 4.2 Pagamento dentro da janela

- criar pedido de quantidade `N`;
- confirmar pagamento antes do deadline;
- comprovar `InventoryReservation = CONSUMED`;
- comprovar decremento persistido de estoque em exatamente `N`;
- repetir/replay da confirmação de pagamento e da ativação;
- comprovar que o estoque não sofre segundo decremento.

## 4.3 Disputa vencida pelo comprador

- partir de pedido pago cujo estoque já foi consumido;
- abrir/processar disputa pelo fluxo futuro real;
- concluir decisão a favor do Buyer;
- comprovar refund/reversal e Ledger coerentes;
- comprovar que proceeds do Seller foram revertidos/bloqueados conforme a política;
- comprovar restauração de exatamente `N` unidades quando o item for elegível;
- repetir a mesma decisão/processamento e comprovar que o estoque não sobe novamente;
- comprovar estado terminal correto do pedido;
- comprovar chat do pedido fechado/read-only para Buyer e Seller;
- comprovar que nenhuma nova review pode ser criada para a transação;
- comprovar que histórico/audit trail necessário continua preservado.

## 4.4 Controles negativos

- Seller vence a disputa: não aplicar automaticamente o rollback de estoque definido para Buyer-win;
- resolução duplicada: não duplicar refund, reversal, eventos, estoque ou Ledger;
- tentativa de frontend de informar quantidade diferente da quantidade histórica: rejeitar/ignorar e usar autoridade server-side;
- item sem estoque: não criar reposição artificial;
- item digital único não elegível para revenda: não recolocar automaticamente no catálogo sem decisão válida de inventário.

---

# 5. Estado atual versus trabalho futuro

## Já existe hoje e deve ser preservado/revalidado

- checkout server-authoritative;
- criação de `InventoryReservation` no pedido;
- TTL padrão de 15 minutos;
- reserva `ACTIVE` reduzindo disponibilidade efetiva;
- expiração de pedido não pago liberando a reserva;
- pagamento dentro do deadline consumindo a reserva;
- decremento definitivo de estoque na ativação de pedido pago;
- proteção contra replay já exercitada no caminho de pagamento/ativação.

## Ainda não deve ser considerado implementado/concluído por este documento

- disputa completa Buyer x Seller;
- decisão administrativa completa de disputa;
- refund/reversal produtivo vinculado à disputa;
- retorno idempotente de estoque após Buyer-win;
- fechamento real do chat por resolução de disputa;
- bloqueio server-side de review após Buyer-win;
- política definitiva para ativos digitais únicos comprometidos;
- chargeback e exceções financeiras completas.

Esses pontos devem permanecer no backlog/gates de produção e ser reconciliados com a documentação autoritativa quando a fase correspondente for iniciada.

---

# 6. Regra de governança

Este registro não deve provocar implementação oportunística durante a auditoria atual.

Quando o projeto entrar na fase de disputa/refund/chargeback/chat/review:

1. revisar este requisito junto com `ALPHA_SCOPE_AND_COMPLETION_CHECKLIST.md`, `FINAL_FUNCTIONAL_VALIDATION_CHECKLIST.md` e contratos financeiros vigentes;
2. verificar novamente o código remoto antes de assumir o que já existe;
3. decidir explicitamente state machines e eventos necessários;
4. preservar invariantes de Ledger e idempotência;
5. implementar em mudanças estreitas e auditáveis;
6. testar browser + HTTP + banco + Ledger conforme aplicável;
7. não declarar produção pronta apenas porque o cenário local passou.
