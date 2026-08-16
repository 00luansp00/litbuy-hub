# LIT Buy — Post-freeze Browser QA Findings

## Finalidade e autoridade

Este arquivo é o ledger persistente dos achados manuais de Browser QA, observações de UX e decisões/requisitos futuros descobertos durante a estabilização pós-feature-freeze.

Ele existe para evitar que informações importantes fiquem somente em uma conversa, checkpoint ou memória temporária.

Regras de autoridade:

1. GitHub remoto continua sendo a fonte de verdade para código, branch, PR, CI e merge.
2. `ALPHA_SCOPE_AND_COMPLETION_CHECKLIST.md` continua sendo a maior autoridade para escopo funcional, feature freeze, conclusão do Alpha e blockers de produção.
3. `CLAUDE_AUDIT_FINDINGS_LEDGER.md` continua sendo a autoridade dos findings formais da auditoria Claude.
4. Este arquivo não transforma automaticamente um achado de browser em blocker do Alpha, finding de segurança ou trabalho autorizado.
5. Uma observação só deve ser marcada como corrigida quando houver evidência objetiva de implementação + regressão/validação aplicável.
6. Requisitos futuros registrados aqui não autorizam implementação durante o feature freeze e não antecipam Phase B/produção.
7. `FINAL_FUNCTIONAL_AUDIT_REPORT.md` consolida por blocos o que foi efetivamente testado, classificado e encontrado durante a validação funcional final; este ledger continua sendo a lista controlada dos findings individuais.

## Convenção de estados

- `OPEN`: comportamento observado e ainda não corrigido.
- `NEEDS_REPRODUCTION`: observação real, mas o cenário precisa ser reproduzido de forma limpa antes de classificar causa/impacto.
- `DECISION_REQUIRED`: requisito futuro ou regra de produto registrada, mas ainda faltam decisões de contrato.
- `CLOSED`: correção implementada e revalidada com evidência objetiva.

## Convenção de impacto

- `CURRENT_BLOCKER`: impede o gate/teste atual.
- `NON_BLOCKER`: deve ser corrigido/avaliado, mas não invalida o gate atual.
- `FUTURE_SCOPE`: requisito deliberadamente reservado para fase futura; não ampliar o Alpha silenciosamente.

---

## Evidência de aceitação — BROWSER-A5

### BROWSER-A5 — fluxo Buyer → FAKE_ALPHA → Seller → Buyer

**Estado:** `PASSED`

**Data da validação local:** 2026-08-15

**PR corretiva:** #81 — `fix(financial): orchestrate alpha sale recognition before availability`

**Head validado:** `20db7aea9dd2a3df0475a1c281cadc8608e88479`

**Merge commit / main após merge:** `3f8d7fb75a2192d08d0bc3e005c4fa4ebce227a4`

**Ambiente:** rehearsal local com `docker-compose.staging.yml`, PostgreSQL/Redis/MinIO reais e `FAKE_ALPHA`; nenhum dinheiro real.

**Pedido de prova:** `LIT-SELPYT2KNHNTYH`

**Valor:** R$ 49,90 (`4990` minor units)

### Evidência pré-Seller

Após aprovação Alpha e antes de qualquer ação do Seller, o banco confirmou:

- `Order.status = ACTIVE`
- `Order.paymentStatus = PAID`
- `Payment.status = PAID`
- `Order.fulfillmentStatus = AWAITING_SELLER`
- `Order.disputeStatus = NONE`
- exatamente `1` `LedgerTransaction` `SALE_RECOGNIZED / OrderSale / <order.id>`
- `SYSTEM / PROVIDER_CLEARING / DEBIT = 4990`
- `SELLER / SELLER_PENDING / CREDIT = 4990`
- nenhuma entrada `SELLER_HELD`
- nenhuma entrada `SELLER_AVAILABLE`
- nenhuma `ReconciliationIssue` `OPEN`/`INVESTIGATING` vinculada ao pedido/reconhecimento

A comissão da plataforma neste pedido foi R$ 0,00, portanto a ausência de `PLATFORM_COMMISSION` é esperada para este caso de prova.

### Evidência após entrega do Seller

Após `Marcar como entregue`:

- `Order.status = ACTIVE`
- `Order.paymentStatus = PAID`
- `Order.fulfillmentStatus = AWAITING_BUYER_CONFIRMATION`
- `Order.disputeStatus = NONE`
- `SALE_RECOGNIZED = 1`
- `SELLER_PENDING credit = 4990`
- `SELLER_HELD credit = 0`
- `SELLER_AVAILABLE credit = 0`

A entrega não provocou movimentação financeira prematura.

### Evidência após confirmação do Buyer

Após `Confirmar recebimento`, a UI exibiu somente o estado de sucesso, sem o erro simultâneo observado no blocker original.

O banco confirmou:

- `Order.status = COMPLETED`
- `Order.paymentStatus = PAID`
- `Order.fulfillmentStatus = CONFIRMED`
- `Order.disputeStatus = NONE`
- `SALE_RECOGNIZED = 1`
- nenhuma `ReconciliationIssue` `OPEN`/`INVESTIGATING` vinculada ao pedido

**Conclusão:** o blocker BROWSER-A5 que motivou a PR #81 foi corrigido e revalidado localmente no fluxo completo. Esta evidência não fecha staging hospedado, produção, PASS2-F1 ou a arquitetura de gatilhos financeiros de produção.

---

## Achados abertos do Browser QA

### QA-BROWSER-001 — notificações visíveis sem autenticação

- **Tipo:** UX / demo boundary
- **Estado:** `OPEN`
- **Impacto:** `NON_BLOCKER`
- **Área:** navbar / notificações
- **Observado em:** página pública/login/estado anônimo no rehearsal local

**Observação:** um visitante não autenticado consegue abrir o sino e visualizar cartões como `Chat do pedido criado`, `Pagamento aprovado`, `Entrega automática liberada` e outros.

**Causa confirmada em 2026-08-15:** `src/services/notificationService.ts` se declara explicitamente uma camada mockada; nenhuma notificação real é enviada, salva ou persistida. `NotificationProvider` possui comportamento deliberado de carregar notificações mesmo sem autenticação para “não deixar o sino vazio na demo”.

**Classificação de risco atual:** a evidência disponível não sustenta vazamento de notificações privadas reais. O problema confirmado é uma superfície demo enganosa no estado anônimo.

**Critério futuro de correção:** visitante anônimo não deve receber conteúdo que pareça atividade privada de uma conta real. Se notificações demonstrativas forem mantidas em algum ambiente, precisam estar explicitamente identificadas e separadas de dados reais.

### QA-BROWSER-002 — CTA e cards da Home sem navegação

- **Tipo:** frontend / navegação / UX
- **Estado:** `OPEN`
- **Impacto:** `NON_BLOCKER`
- **Área:** Home

**Observação:** o CTA `Explorar produtos` e os quatro cards destacados do Hero (`Steam`, `Valorant`, `FIFA`, `Xbox GP`) não navegam para uma superfície útil durante o teste manual.

**Causa/classificação:** os quatro cards são hardcoded/decorativos, não anúncios do catálogo público real. O CTA também não entrega uma jornada real de exploração.

**Critério futuro de correção:** cada CTA/card visualmente interativo deve possuir destino real coerente ou deixar de se apresentar como ação clicável. Uma alternativa de produto é alimentar a área com anúncios reais/destaques reais; outra é preservá-la como decoração inequívoca.

### QA-BROWSER-003 — tela de pagamento permanece stale após aprovação Alpha

- **Tipo:** frontend / cache / mutation state / UX
- **Estado:** `OPEN`
- **Impacto:** `NON_BLOCKER`
- **Área:** `/pagamento/$id`
- **Pedido observado:** `LIT-SELPYT2KNHNTYH`

**Observação:** após a aprovação Alpha ter progredido corretamente no backend, a tela de pagamento chegou a permanecer exibindo combinação visual desatualizada (`PAGAMENTO_PENDENTE` / `Não criado` / tentativa `SUCCEEDED`). Ao abrir `Meus pedidos`, o estado persistido real já estava correto em `ACTIVE / PAID / AWAITING_SELLER`.

**Evidência de backend:** o BROWSER-A5 completo passou e o PostgreSQL confirmou os estados autoritativos corretos.

**Critério futuro de correção:** após mutation de aprovação Alpha, revalidar/refetchar as fontes necessárias para que a tela reflita o estado persistido sem exigir navegação manual para outra rota.

### QA-BROWSER-004 — mensagens de erro/replay em primeira tentativa contaminada

- **Tipo:** payment UX / replay / erro a reproduzir
- **Estado:** `NEEDS_REPRODUCTION`
- **Impacto:** `NON_BLOCKER` até reprodução limpa
- **Área:** `/pagamento/$id`
- **Pedido histórico da rodada:** `LIT-YYZCL5TUACRGMJ`

**Observação:** durante a primeira tentativa da rodada apareceram mensagens como `RECONCILIAÇÃO DE PAGAMENTO NECESSÁRIA` e, após refresh/repetição manual, `PEDIDO NÃO ENCONTRADO`.

**Limitação da evidência:** o cenário foi contaminado por refresh e repetição da ação enquanto a investigação estava em andamento. Portanto ele não deve ser usado como prova de regressão da PR #81 nem como causa já diagnosticada.

**Próximo passo futuro:** reproduzir desde pedido novo, uma ação por vez, capturando request/response, logs e banco antes de classificar causa e severidade.

### QA-BROWSER-005 — termo de busca permanece na Navbar após sair da busca

- **Tipo:** frontend / UX / route state
- **Estado:** `OPEN`
- **Impacto:** `NON_BLOCKER`
- **Área:** Navbar / `/buscar`

**Observação:** após pesquisar, por exemplo, `jogo` e navegar de volta para Home/categoria, o termo continua visível no campo da Navbar mesmo que a rota atual não represente mais aquele resultado.

**Causa confirmada:** a Navbar mantém `searchQuery` como estado local e não o reconcilia/limpa quando a rota deixa `/buscar`.

**Contexto adicional:** a busca global atual é `MOCK-DEMO`; `searchService.ts` se declara camada mockada e usa dados legados, não o catálogo público real.

**Critério futuro de correção:** sincronizar o campo com a rota/query ou limpá-lo ao sair da busca, conforme decisão de UX.

### QA-BROWSER-006 — catálogo real perdeu sinais comerciais/trust presentes no protótipo

- **Tipo:** UX / conversão / public catalog
- **Estado:** `OPEN`
- **Impacto:** `NON_BLOCKER`
- **Área:** cards reais / detalhe público / seller storefront

**Observação:** o catálogo público real está conectado à API e é funcional, mas sua apresentação comercial é significativamente mais pobre que a superfície mockada/legada.

**Ausências confirmadas na superfície pública real atual:**

- favorito real;
- avaliação média e quantidade de avaliações;
- quantidade vendida;
- selo público de seller verificado;
- reputação/confiança;
- badge comercial forte de entrega manual/automática;
- promoção/desconto/preço anterior;
- compartilhar;
- denunciar anúncio;
- produtos relacionados;
- perguntas ao vendedor;
- perfil mais completo da loja;
- link clicável para a loja em `Sobre a loja`.

**Correção de interpretação:** `deliveryMode` e, para serviços, `estimatedDelivery`, existem no contrato real e são exibidos, porém de forma pouco destacada; não são dados ausentes do backend.

**Regra de integridade:** sinais como estrelas, número de vendas, verificação, confiança e desconto não podem ser copiados do mock como números fictícios. Precisam de autoridade real e auditável.

**Critério futuro:** definir quais sinais pertencem ao produto final e, para cada um, a fonte autoritativa, persistência, permissão de alteração e regra de publicação.

### QA-BROWSER-007 — intenção de compra é perdida durante autenticação

- **Tipo:** frontend / auth redirect / buyer conversion
- **Estado:** `OPEN`
- **Impacto:** `NON_BLOCKER`
- **Área:** produto público → login

**Observação:** no fluxo `Produto real → Entrar para comprar → Login`, após autenticar o usuário é enviado para `/`, o produto não é preservado no contexto e não existe continuidade automática para carrinho/revisão.

**Causa confirmada:** `PublicProductPurchasePanel` usa link simples para `/login` sem `returnTo`/intenção; a rota `login.tsx`, ao concluir autenticação, navega diretamente para `/`.

**Decisão necessária antes da correção:** preservar a intenção sem introduzir auto-add silencioso/replay. Opções incluem retornar ao mesmo produto ou conduzir para revisão/carrinho após confirmação explícita.

**Critério futuro de correção:** autenticar não deve apagar a jornada que motivou o login.

### QA-BROWSER-008 — formatos de serviço aparecem como opções, mas não são selecionáveis

- **Tipo:** produto / service variants / UX funcional
- **Estado:** `DECISION_REQUIRED`
- **Impacto:** `NON_BLOCKER`
- **Área:** detalhe público de produto `SERVICE`

**Observação:** a seção `Formatos do serviço` pode exibir cards como `Sessão — R$ 79,90 — Estoque 1`, mas esses cards são apenas `<article>` informativos e não possuem seleção/click.

**Contraste validado:** produto `DYNAMIC` como `Licença digital — Opções demonstrativas` possui variantes `Mensal`/`Anual` realmente selecionáveis e a escolha alimenta `productVariantId` no carrinho.

**Decisão necessária:** definir se serviços podem ter formatos/pacotes realmente compráveis. Se sim, o contrato precisa cobrir criação pelo Seller, preço/estoque, seleção Buyer, cart item e snapshot de checkout; não basta tornar o card visualmente clicável.

---

## Requisitos futuros registrados durante o Browser QA

### FUTURE-CHAT-001 — chat do pedido permanece acessível após conclusão

- **Tipo:** requisito de produto
- **Estado:** `DECISION_REQUIRED`
- **Impacto:** `FUTURE_SCOPE`
- **Domínio:** chat / pós-compra

**Regra já estabelecida:** concluir o pedido (`COMPLETED`) não deve, por si só, encerrar ou tornar inacessível a conversa vinculada ao pedido. Buyer e Seller devem continuar conseguindo consultar e usar o chat para tratar problemas posteriores.

**Ainda não definido:** retenção, janela temporal, políticas de moderação, anexos, bloqueios, arquivamento e regras de acesso após encerramentos administrativos.

### FUTURE-MEDIATION-001 — abertura de mediação por Buyer ou Seller no contexto do pedido/chat

- **Tipo:** requisito de produto
- **Estado:** `DECISION_REQUIRED`
- **Impacto:** `FUTURE_SCOPE`
- **Domínio:** mediação / disputa / chat

**Regra já estabelecida:** Buyer e Seller deverão ter uma ação clara, no contexto do pedido/chat ou em posição equivalente da tela, para iniciar uma mediação.

A abertura deverá oferecer categorias pré-definidas do problema antes da criação da mediação.

**Ainda não definido:**

- categorias finais;
- prazo para abertura após compra/entrega/conclusão;
- SLA e máquina de estados;
- evidências/anexos;
- relação com `disputeStatus`;
- efeitos sobre `SELLER_PENDING`, `SELLER_HELD` e `SELLER_AVAILABLE`;
- poderes do Admin/mediador;
- encerramento/reabertura;
- notificações e trilha de auditoria.

Nenhuma dessas lacunas deve ser preenchida silenciosamente durante o feature freeze.

---

## Regra de proveniência para dados públicos do anúncio

Durante a auditoria Seller/Admin, para cada dado exibido no anúncio público deve ser verificado:

1. quem fornece o dado;
2. onde ele é armazenado;
3. quem possui autorização para alterá-lo;
4. qual serviço/autoridade o publica;
5. como ele se mantém consistente após refresh e mudanças de estado.

Exemplos:

- título, descrição, preço, estoque, delivery mode, variantes e prazo de serviço podem ser informados pelo Seller dentro do contrato permitido;
- avaliações, vendas, verificação e reputação devem ser derivados pelo sistema;
- favorito, compartilhar, denunciar e perguntas são ações do Buyer/UI;
- descontos/promos, storefront, relacionados e trust score exigem contrato/regra explícita antes de serem tratados como reais.

---

## Regra operacional para novas descobertas

Quando durante Browser QA surgir a instrução “anota isso” ou equivalente:

1. preservar a evidência da observação;
2. classificar como `OPEN`, `NEEDS_REPRODUCTION`, `DECISION_REQUIRED` ou `CLOSED`;
3. classificar impacto como `CURRENT_BLOCKER`, `NON_BLOCKER` ou `FUTURE_SCOPE`;
4. não interromper o gate atual por um `NON_BLOCKER` sem justificativa objetiva;
5. alimentar este ledger na próxima atualização documental controlada;
6. atualizar `FINAL_FUNCTIONAL_AUDIT_REPORT.md` ao encerrar o bloco funcional correspondente;
7. atualizar a checklist operacional quando o estado global de estabilização mudar;
8. nunca transformar requisito futuro em implementação autorizada sem decisão explícita.
