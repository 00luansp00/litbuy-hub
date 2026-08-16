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
- **Estado:** `CLOSED — comportamento atual revalidado`
- **Impacto:** `NON_BLOCKER`
- **Área:** `/pagamento/$id`
- **Pedido observado:** `LIT-SELPYT2KNHNTYH`

**Observação:** após a aprovação Alpha ter progredido corretamente no backend, a tela de pagamento chegou a permanecer exibindo combinação visual desatualizada (`PAGAMENTO_PENDENTE` / `Não criado` / tentativa `SUCCEEDED`). Ao abrir `Meus pedidos`, o estado persistido real já estava correto em `ACTIVE / PAID / AWAITING_SELLER`.

**Disposição final em 2026-08-16:** o histórico stale acima permanece preservado, mas a revalidação limpa atual não reproduziu o finding. A PR #87 não alterou frontend/cache e **não** é declarada como sua correção; o fechamento decorre do comportamento atual revalidado.

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

### QA-BROWSER-009 — Navbar exibe estado anônimo durante bootstrap da sessão

- **Tipo:** frontend / Auth / UX
- **Estado:** `OPEN`
- **Impacto:** `NON_BLOCKER`
- **Área:** Navbar / restauração de sessão
- **Observado em:** Home e `/perfil/seguranca` após `F5`

**Observação:** uma sessão válida é recuperada corretamente após refresh, porém por aproximadamente um segundo a Navbar exibe `Entrar` / `Criar conta` antes de voltar ao usuário autenticado.

**Causa confirmada:** `AuthProvider` inicia com `status="initializing"` e `user=null`, executa `refresh()` e depois `/auth/me`; durante esse intervalo `isAuthenticated` é falso. A Navbar decide o estado visual somente por `isAuthenticated` e não neutraliza o estado `initializing`.

**Classificação de risco:** não houve evidência de perda real da sessão ou autorização. É um flicker/estado visual enganoso de Auth.

**Critério futuro de correção:** durante bootstrap da sessão persistida, renderizar estado neutro/loading apropriado e não afirmar temporariamente que o usuário está deslogado.

### QA-BROWSER-010 — política de senha precisa de hardening central

- **Tipo:** Auth / security-hardening
- **Estado:** `OPEN`
- **Impacto:** `NON_BLOCKER`
- **Área:** cadastro / alteração de senha / reset

**Estado atual confirmado:** a autoridade central aceita senha de 12 a 128 caracteres desde que não seja somente whitespace; hashing usa Argon2id.

**Regra registrada:** a política final deve ser mais forte que o simples mínimo atual e continuar centralizada no backend. A mesma autoridade deve valer para cadastro, alteração de senha e redefinição de senha; o frontend orienta, mas não pode ser a única barreira.

**Direção de hardening:** considerar comprimento/passphrases e bloqueio de senhas comuns/comprometidas. Não congelar uma regra arbitrária diferente por tela nem exigir composição rígida sem revisão de segurança.

**Critério futuro:** definição final revisada no gate de segurança/humano sênior e aplicada de modo consistente a todo fluxo que define uma nova senha.

### QA-BROWSER-011 — Termos/Privacidade interrompem o cadastro e podem perder contexto

- **Tipo:** UX / cadastro / conversão
- **Estado:** `OPEN`
- **Impacto:** `NON_BLOCKER`
- **Área:** `/cadastro` → `/termos` / `/privacidade`

**Observação:** os links legais abrem outra rota na mesma guia. Como o formulário mantém dados em estado local, a navegação pode destruir o que o usuário já preencheu.

**Critério futuro de correção:** permitir leitura sem perder o formulário, preferencialmente via modal/drawer rolável e opção secundária para abrir o documento completo em nova guia. O aceite continua explícito e separado.

### QA-BROWSER-012 — tentativa/dispositivo pendente não é visível ao dono da conta

- **Tipo:** security UX / account protection
- **Estado:** `OPEN`
- **Impacto:** `NON_BLOCKER`
- **Área:** `/perfil/seguranca`

**Observação:** o fluxo de novo dispositivo funcionou e bloqueou o login até aprovação, mas enquanto o device estava `PENDING` ele não apareceu na seção `Dispositivos aprovados` do navegador confiável.

**Classificação:** não é falha comprovada da autorização; reduz visibilidade do titular sobre tentativa pendente.

**Critério futuro de hardening:** considerar seção separada para tentativas/dispositivos aguardando aprovação, com dados seguros de contexto e ação `Não fui eu`/bloqueio quando apropriado, sem expor PII ou sinais de risco desnecessários.

---

### QA-BROWSER-013 — pedido vencido permanece visualmente acionável antes da materialização de expiração

- **Classificação:** `REAL-BUG` / coerência temporal da UI Buyer
- **Estado:** `OPEN`
- **Impacto:** `NON_BLOCKER` no rehearsal local

O backend falha fechado pelo deadline e a rotina real de expiração libera a reserva sem inventar estoque. Ainda assim, a UI pode permanecer acionável até a materialização/processamento da expiração. Não corrigido nesta reconstrução documental; permanece relevante para operação/scheduler produtivo.

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

### FUTURE-AUTH-001 — autenticação federada Google

- **Tipo:** Auth / produto
- **Estado:** `DECISION_REQUIRED`
- **Impacto:** `FUTURE_SCOPE`
- **Domínio:** login federado

**Regra registrada:** não exibir `Continuar com Google` como ação funcional até existir fluxo real de OAuth/backend, vínculo com conta existente, sessão, logout, dispositivos, eventual 2FA e recuperação.

### FUTURE-AUTH-002 — MFA forte adicional para operações privilegiadas

- **Tipo:** security-hardening
- **Estado:** `DECISION_REQUIRED`
- **Impacto:** `FUTURE_SCOPE`
- **Domínio:** Auth / Admin / financeiro

**Direção registrada:** avaliar TOTP/authenticator e/ou passkey/WebAuthn, com prioridade maior para Admin e ações financeiras. E-mail/SMS não devem ser falsamente tratados como única proteção final de contas privilegiadas.

### FUTURE-SECURITY-001 — alteração sensível, hold de 72h e monitoramento de risco

- **Tipo:** security / account protection / financeiro futuro
- **Estado:** `DECISION_REQUIRED`
- **Impacto:** `FUTURE_SCOPE`
- **Domínio:** alteração de e-mail / risco / saque

**Decisão estabelecida:** após **troca concluída de e-mail**, o hold financeiro desejado é de **72 horas**, substituindo o default atual de 48 horas para essa regra de produto/segurança.

**Requisitos registrados:** logging seguro, sem tokens/senhas/cookies/códigos; fila/painel de Segurança/Risco acessível somente a operadores autorizados; step-up adicional quando 2FA estiver ativo; tentativa de saque durante hold deve ser negada pela API e gerar evidência rastreável quando saque existir.

**Ainda exige desenho/revisão:** granularidade de permissões da equipe, regras de alerta, outras mudanças sensíveis abrangidas pelo mesmo período e integração com o futuro domínio financeiro.

### FUTURE-ADMIN-SECURITY-001 — hardening de contas e painel privilegiado

- **Tipo:** security / privileged access
- **Estado:** `DECISION_REQUIRED`
- **Impacto:** `FUTURE_SCOPE`
- **Domínio:** Admin

**Direção registrada:** MFA forte obrigatório, dispositivo aprovado, sessão administrativa mais curta, step-up para ações críticas, permissões granulares/least privilege, logs/alertas e eventual camada adicional de infraestrutura/rede em produção. Conhecer a URL `/admin` nunca deve conceder autoridade.

### FUTURE-WITHDRAWAL-KYC-001 — verificação documental obrigatória antes do saque

- **Tipo:** produto / KYC / financeiro / compliance
- **Estado:** `DECISION_REQUIRED`
- **Impacto:** `FUTURE_SCOPE`
- **Domínio:** Seller / saque

**Regra de produto estabelecida:** o onboarding Seller mínimo atual pode habilitar a conta para vender após os requisitos/análise existentes, mas isso não equivale a KYC financeiro completo. **Saque real deve permanecer bloqueado até verificação documental mínima aprovada manualmente pela equipe LIT Buy**, além dos demais gates de segurança/risco.

**Separação obrigatória:** `habilitado para vender` e `vendedor verificado para saque/selo` são conceitos distintos. O endpoint de saque futuro deve aplicar essa regra server-side; esconder o botão não é suficiente.

**Ainda exige revisão humana:** conjunto final de documentos/dados, PSP, compliance, LGPD, política de retenção e eventual exigência de verificação anterior à venda.

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
