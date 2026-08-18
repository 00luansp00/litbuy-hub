# LIT Buy — Final Functional Validation Checklist

## Finalidade

Este documento define a bateria manual/operacional que deve ser executada antes de considerar encerrada a fase de vibe-coding/remediação assistida por IA e preparar o `PRODUCTION_HANDOFF.md` para revisão humana sênior.

Ele **não redefine o escopo funcional do Alpha**, não autoriza Phase B, não autoriza dinheiro real e não transforma funcionalidades futuras em blockers atuais. `ALPHA_SCOPE_AND_COMPLETION_CHECKLIST.md` continua sendo a autoridade funcional máxima; `CLAUDE_AUDIT_FINDINGS_LEDGER.md` continua sendo a autoridade dos findings formais da auditoria; `POST_FREEZE_BROWSER_QA_FINDINGS.md` continua sendo o ledger dos achados manuais de Browser QA.

A regra desta checklist é simples:

> Tudo que a aplicação atualmente apresenta ao usuário como uma capacidade funcional deve terminar classificado e, quando for realmente implementado, deve ser exercitado de ponta a ponta.

## Reconciliação anti-repetição pós-PR #97 — 2026-08-17

Antes de qualquer novo teste, responder: **ITEM → JÁ TESTADO? → ONDE ESTÁ A EVIDÊNCIA? → CÓDIGO RELEVANTE MUDOU DEPOIS? → PRECISA REPETIR?** Buyer critical flow/pagamento Alpha, Seller onboarding, ListingDraft lifecycle, Seller delivery, Seller finance, `PASS2-F2`, `PASS2-F3` e auth refresh #95 já possuem evidência suficiente e não são tarefas obrigatoriamente inéditas. Só repetir por mudança relevante, regressão objetiva ou revalidação final deliberada.

- [x] Auth refresh #95: blocker concorrente encerrado por single-flight e revalidado; evidência em `FINAL_FUNCTIONAL_AUDIT_BLOCK_2_AUTH.md`. `QA-BROWSER-009` permanece separado e aberto.
- [x] Buyer critical block/pagamento Alpha: `REAL-TESTED`; evidência consolidada em `FINAL_FUNCTIONAL_AUDIT_REPORT.md` e Browser QA.
- [x] Seller onboarding: `REAL-TESTED`; o limite de duas re-submissões é decisão de produto **não implementada**, não um `PASS`.
- [x] ListingDraft lifecycle, delivery e Seller finance: `REAL-TESTED`; evidência consolidada no relatório funcional.
- [x] `PASS2-F2`: `FIXED / REAL-TESTED` pela PR #96, CI #348 / run `32064187807`, filtro revalidado no browser.
- [x] `PASS2-F3`: `FIXED / REAL-TESTED` pela PR #97, CI #350 / run `32079416748`, persistência confirmada após `F5` e no DB.
- [ ] Chat transacional do pedido: `CURRENT COMMERCE GAP / NOT IMPLEMENTED / DECISION REQUIRED`; não transformar decisão em conclusão.
- [ ] Limite de duas re-submissões Seller após rejeição: `NOT IMPLEMENTED / PRODUCT DECISION / NON_BLOCKER`.

Nenhuma alteração de escopo Alpha é feita nesta reconciliação.

Nenhum botão, formulário, rota, card aparentemente interativo ou operação administrativa relevante deve ficar ambíguo no handoff.

## Classificação obrigatória por capacidade

Cada item/controle/superfície inspecionado deve terminar com uma destas classificações:

- `REAL-TESTED` — implementação real conectada à autoridade correta e validada manualmente/tecnicamente.
- `REAL-BUG` — implementação real existe, mas apresentou defeito objetivo; registrar no ledger apropriado.
- `MOCK-DEMO` — conteúdo/ação demonstrativa sem autoridade operacional real.
- `NOT-IMPLEMENTED` — capability esperada/visível não existe de forma funcional.
- `FUTURE-SCOPE` — capability deliberadamente futura e não deve ser implementada silenciosamente nesta fase.
- `HUMAN-SENIOR` — depende de decisão/revisão/implementação humana sênior, segurança, infraestrutura, dinheiro real ou arquitetura de produção.
- `NOT-APPLICABLE` — item não pertence ao estado/escopo atual, com justificativa registrada.

Para uma capacidade ser `REAL-TESTED`, sempre que aplicável devem existir evidências de:

1. UI/browser;
2. request/response ou serviço real;
3. persistência no banco;
4. autorização correta;
5. refresh/reload mantendo o estado;
6. idempotência/replay quando a operação for sensível;
7. invariantes de domínio/financeiras quando aplicável.

---

# 1. Ambiente e baseline

- [ ] Confirmar `main` remoto e SHA exato que será validado.
- [ ] Confirmar working tree local limpa e checkout do SHA correto.
- [ ] Confirmar CI completo verde para o HEAD validado.
- [ ] Executar instalação com lockfile congelado.
- [ ] Executar `demo:down` quando necessário para limpar containers antigos sem apagar volumes acidentalmente.
- [ ] Executar `demo:prepare`.
- [ ] Executar `demo:check`.
- [ ] Confirmar frontend saudável.
- [ ] Confirmar backend saudável.
- [ ] Confirmar PostgreSQL saudável.
- [ ] Confirmar Redis saudável.
- [ ] Confirmar MinIO/object storage saudável.
- [ ] Confirmar `FAKE_ALPHA`/modo local não produtivo onde aplicável.
- [ ] Confirmar que nenhum dinheiro real, PSP produtivo, payout ou saque foi habilitado.
- [ ] Registrar data, SHA, CI e ambiente usados na rodada final.

# 2. Inventário visual e operacional

Percorrer todas as rotas/telas relevantes antes de iniciar os fluxos profundos.

- [ ] Listar todas as rotas públicas visíveis.
- [ ] Listar todas as rotas Buyer visíveis.
- [ ] Listar todas as rotas Seller visíveis.
- [ ] Listar todas as rotas Admin visíveis.
- [ ] Identificar botões/CTAs/cards aparentemente clicáveis.
- [ ] Identificar formulários e mutations.
- [ ] Identificar tabelas com ações.
- [ ] Identificar controles que alteram configuração/política.
- [ ] Identificar telas que ainda usam conteúdo mock/demo/hardcoded.
- [ ] Classificar cada capacidade como `REAL-TESTED`, `REAL-BUG`, `MOCK-DEMO`, `NOT-IMPLEMENTED`, `FUTURE-SCOPE`, `HUMAN-SENIOR` ou `NOT-APPLICABLE`.
- [ ] Nenhuma superfície operacional fica sem classificação no handoff.

# 3. Área pública / visitante anônimo

## 3.1 Home

- [ ] Home carrega sem erro.
- [ ] Categorias reais carregam pela API.
- [ ] Seção de catálogo público carrega anúncios reais pela API.
- [ ] Cards de produtos reais abrem o detalhe correto.
- [ ] Estado vazio real aparece quando não há anúncios públicos.
- [ ] Estado de erro de API é compreensível e permite retry quando previsto.
- [ ] CTAs da Home possuem destino coerente ou são claramente decorativos.
- [ ] Cards decorativos/hardcoded não simulam anúncio real clicável sem deixar isso claro.
- [ ] `Explorar produtos` leva a uma superfície útil real; se continuar apontando para a própria Home, classificar/corrigir.
- [ ] Não há informação privada de Buyer/Seller/Admin para visitante anônimo.
- [ ] Revisar finding de notificações anônimas do `POST_FREEZE_BROWSER_QA_FINDINGS.md`.

## 3.2 Categoria e catálogo

- [ ] Categoria válida carrega taxonomia real.
- [ ] Produtos listados pertencem ao catálogo público real.
- [ ] Categoria/slug inexistente usa estado seguro.
- [ ] Filtros implementados realmente alteram a consulta/resultado.
- [ ] Ordenação implementada realmente funciona.
- [ ] Paginação implementada funciona.
- [ ] Nenhum produto não elegível aparece publicamente.

## 3.3 Produto

- [ ] Produto válido carrega dados reais.
- [ ] Imagens assinadas/armazenadas funcionam conforme implementação atual.
- [ ] Preço exibido corresponde à autoridade atual.
- [ ] Seller exibido corresponde ao produto real.
- [ ] Produto indisponível bloqueia compra quando aplicável.
- [ ] Breadcrumbs/links internos funcionam.
- [ ] ID/slug inválido cai em estado seguro.
- [ ] Componentes de review/perguntas/relacionados que ainda forem mock são classificados explicitamente.

## 3.4 Busca, loja pública e outras superfícies

Para cada superfície que existir visualmente:

- [ ] Confirmar se é real ou demo.
- [ ] Se real, executar busca/navegação com dados reais.
- [ ] Se não implementada, classificar sem tratá-la como concluída.
- [ ] Não transformar silenciosamente essa superfície em blocker do Alpha.

# 4. Autenticação e sessão

- [ ] Cadastro real com dados locais de teste.
- [ ] Login com credenciais válidas.
- [ ] Login inválido falha com mensagem segura.
- [ ] Logout encerra a sessão esperada.
- [ ] Refresh mantém sessão quando deveria.
- [ ] Sessão expirada perde acesso corretamente.
- [ ] Recuperação de senha: validar somente o que está implementado/conectado no ambiente.
- [ ] E-mail/telefone/2FA/recovery codes: validar o que estiver no escopo operacional da rodada.
- [ ] Buyer não ganha acesso Seller/Admin por manipulação de frontend.
- [ ] Seller não ganha acesso Admin.
- [ ] Rotas protegidas não dependem apenas de ocultar menus.
- [ ] Mutations protegidas exercitam CSRF/session boundary aprovado.
- [ ] Refresh/logout não deixam dados privados indevidamente visíveis.

# 5. Buyer — carrinho e checkout

## 5.1 Carrinho

- [ ] Adicionar produto real ao carrinho.
- [ ] Carrinho persiste no backend.
- [ ] Atualizar quantidade/versão quando aplicável.
- [ ] Remover item.
- [ ] Refresh mantém estado.
- [ ] Produto indisponível/reconciliado é tratado corretamente.
- [ ] Carrinhos de sellers diferentes respeitam regra atual de checkout por seller.
- [ ] Buyer A não acessa/modifica carrinho do Buyer B.
- [ ] Repetição de mutation não cria estado inválido.

## 5.2 Checkout

- [ ] Checkout lê o carrinho real selecionado.
- [ ] Preço final vem do backend.
- [ ] Estoque/reserva é server-authoritative.
- [ ] Snapshot imutável de preço/comissão é criado corretamente.
- [ ] Fingerprint/version stale falha com segurança.
- [ ] Idempotency key evita duplicação de pedido.
- [ ] Pedido real é criado.
- [ ] Navegação para pagamento usa o pedido correto.
- [ ] Buyer não consegue concluir checkout de carrinho alheio.

# 6. Buyer — pagamento Alpha local

- [ ] Pedido novo inicia no estado esperado.
- [ ] Iniciar billing cria/usa Payment/PaymentAttempt correto.
- [ ] Simular `FAKE_ALPHA` somente no ambiente autorizado.
- [ ] PaymentAttempt converge para `SUCCEEDED`.
- [ ] Payment converge para `PAID`.
- [ ] Order converge para `ACTIVE/PAID`.
- [ ] `SALE_RECOGNIZED` existe exatamente uma vez antes de exposição ao Seller.
- [ ] Idempotency key do reconhecimento é determinística/correta quando verificada.
- [ ] Ledger da venda é balanceado.
- [ ] `SELLER_PENDING` recebe o proceeds correto.
- [ ] `PLATFORM_COMMISSION` aparece somente quando a comissão do snapshot for > 0.
- [ ] Nenhum `SELLER_HELD`/`SELLER_AVAILABLE` surge prematuramente.
- [ ] Nenhuma `ReconciliationIssue` ativa indevida fica associada à venda limpa.
- [ ] Refresh da página de pagamento reflete o estado persistido.
- [ ] Revalidar `QA-BROWSER-003` (tela stale).
- [x] `QA-BROWSER-004` fechado para o cenário local/`FAKE_ALPHA` por validações limpas posteriores; preservar a tentativa contaminada e não repetir apenas para recriar evidência. Não prova PSP/produção.
- [ ] Replay da confirmação Alpha não duplica Payment/Attempt/SALE_RECOGNIZED.

# 7. Buyer — pedidos e pós-compra

- [ ] Lista de pedidos mostra somente pedidos do Buyer autenticado.
- [ ] Detalhe abre pelo código/ID correto.
- [ ] Buyer A não acessa pedido do Buyer B.
- [ ] Estado de pagamento exibido corresponde ao banco.
- [ ] Estado de fulfillment exibido corresponde ao banco.
- [ ] Estado de disputa exibido corresponde ao banco.
- [ ] Após Seller entregar, Buyer vê `AWAITING_BUYER_CONFIRMATION`/equivalente.
- [ ] `Confirmar recebimento` funciona exatamente uma vez.
- [ ] UI não exibe sucesso e erro simultâneos.
- [ ] Pedido converge para `COMPLETED/PAID/CONFIRMED/NONE` no caso limpo.
- [ ] `SALE_RECOGNIZED` continua único.
- [ ] Refresh após conclusão mantém o estado correto.
- [ ] Clique repetido/replay não duplica efeitos financeiros.
- [ ] Chat/review/mediação que ainda não forem implementados são classificados conforme escopo futuro, sem serem tratados como concluídos.

# 8. Seller — onboarding e autorização

- [ ] Buyer pode iniciar solicitação Seller conforme fluxo implementado.
- [ ] Solicitação persiste.
- [ ] Estado pendente aparece corretamente.
- [ ] Admin visualiza a solicitação real.
- [ ] Admin aprova cenário de teste.
- [ ] Papel `SELLER` e `SellerProfile` surgem conforme contrato.
- [ ] Cenário de rejeição funciona e persiste.
- [ ] Reenvio/correção funciona se implementado.
- [ ] Seller não consegue aprovar a própria solicitação.
- [ ] Buyer não ganha role Seller antes da aprovação válida.

# 9. Seller — anúncios/listings

- [ ] Criar `ListingDraft` real.
- [ ] Editar rascunho.
- [ ] Usar taxonomia real.
- [ ] Campos condicionais/atributos obrigatórios são validados.
- [ ] Upload/associação de imagem funciona dentro da foundation implementada.
- [ ] Confirmar ownership de imagens/listing.
- [ ] Submeter para moderação.
- [ ] Admin recebe item real na fila.
- [ ] Admin rejeita com motivo.
- [ ] Seller vê rejeição.
- [ ] Seller corrige e reenvia.
- [ ] Admin aprova.
- [ ] Materialização idempotente cria exatamente um Product quando aplicável.
- [ ] Lifecycle de publicação/ativação segue regras atuais.
- [ ] Produto público aparece somente quando elegível.
- [ ] Seller A não edita anúncio/produto do Seller B.
- [ ] Version/expectedVersion stale falha fechado.
- [ ] Refresh mantém o estado persistido.

# 10. Seller — vendas e entrega

- [ ] Seller vê somente vendas próprias.
- [ ] Lista de vendas abre sem rota quebrada.
- [ ] Detalhe de venda correto abre.
- [ ] Pedido `ACTIVE/PAID/AWAITING_SELLER` é exibido corretamente.
- [ ] `Marcar como entregue` funciona uma única vez.
- [ ] Banco converge para `AWAITING_BUYER_CONFIRMATION`.
- [ ] Venda continua `ACTIVE/PAID` antes da confirmação Buyer.
- [ ] Entrega não cria novo `SALE_RECOGNIZED`.
- [ ] Entrega não move dinheiro prematuramente para `HELD`/`AVAILABLE`.
- [ ] Seller A não entrega venda do Seller B.
- [ ] Replay/clique duplicado falha ou no-op de forma segura.

# 11. Seller — financeiro

- [ ] Resumo financeiro usa endpoints reais owner-only.
- [ ] `PENDING` corresponde ao Ledger.
- [ ] `HELD` corresponde ao Ledger.
- [ ] `AVAILABLE` corresponde ao Ledger.
- [ ] `RESERVED` corresponde ao Ledger quando aplicável.
- [ ] `DEFICIT` corresponde ao Ledger quando aplicável.
- [ ] Activity/paginação por cursor funciona.
- [ ] Valores minor units são formatados corretamente.
- [ ] Seller A não lê financeiro do Seller B.
- [ ] Refresh não altera os saldos por efeito colateral.
- [ ] Qualquer CTA de saque/payout que não seja real deve ser `MOCK-DEMO`, `NOT-IMPLEMENTED` ou `FUTURE-SCOPE` — nunca aparentar dinheiro real disponível para saque.

# 12. Admin — autorização e superfície mínima real

- [ ] Visitante não acessa operações Admin.
- [ ] Buyer não acessa operações Admin.
- [ ] Seller sem role Admin não acessa operações Admin.
- [ ] Admin autenticado acessa as superfícies permitidas.
- [ ] Backend rejeita mutations sem role Admin mesmo se o frontend for manipulado.
- [ ] Todas as páginas Admin visíveis recebem classificação de capability.

# 13. Admin — vendedores

- [ ] Listar solicitações Seller reais.
- [ ] Abrir detalhe real quando aplicável.
- [ ] Aprovar solicitação.
- [ ] Confirmar persistência no banco.
- [ ] Confirmar concessão de role/profile.
- [ ] Rejeitar solicitação.
- [ ] Confirmar motivo/estado persistido.
- [ ] Refresh mantém decisão.
- [ ] Operação repetida não corrompe estado.

# 14. Admin — anúncios/moderação

- [ ] Listar `ListingDraft` reais.
- [ ] Filtros implementados usam parâmetros corretos do backend.
- [x] `PASS2-F2` (`category` vs `categoryId`) revalidado e fechado pela PR #96; não repetir sem gatilho objetivo.
- [ ] Iniciar análise quando a operação existir.
- [ ] Rejeitar com motivo.
- [ ] Aprovar.
- [ ] Confirmar persistência.
- [ ] Confirmar efeitos corretos em materialização/lifecycle.
- [ ] Refresh mantém estado.
- [ ] Admin não consegue executar transição inválida sem resposta segura.

# 15. Admin — catálogo/taxonomia

- [ ] Listar categorias reais.
- [ ] Listar subcategorias reais.
- [ ] Criar/editar/ativar/desativar somente mutations efetivamente implementadas.
- [ ] Validar constraints e duplicidades.
- [ ] Confirmar persistência no banco.
- [ ] Confirmar efeito no catálogo público onde aplicável.
- [ ] Refresh mantém estado.
- [ ] Usuário sem role Admin não consegue mutar taxonomia.

# 16. Admin — taxas, comissão e políticas financeiras

Este bloco é obrigatório como **classificação**, mesmo que a capability ainda não exista no frontend.

- [ ] Verificar se existe UI Admin real para editar comissão/taxa/política.
- [ ] Verificar se a UI usa backend/policy real ou apenas mock/hardcode.
- [ ] Se não existir, classificar `NOT-IMPLEMENTED`, `FUTURE-SCOPE` ou `HUMAN-SENIOR` conforme decisão de handoff.
- [ ] Se existir e estiver autorizada nesta fase, alterar uma política de teste (ex.: comissão X → Y) em ambiente local.
- [ ] Confirmar persistência/versionamento da nova política.
- [ ] Confirmar que pedido criado **antes** da mudança mantém snapshot antigo.
- [ ] Confirmar que pedido criado **depois** da mudança usa a nova política.
- [ ] Confirmar comissão no Ledger a partir do snapshot correto.
- [ ] Confirmar proceeds do Seller correto.
- [ ] Confirmar que alteração não reescreve vendas históricas.
- [ ] Confirmar autorização Admin server-side.
- [ ] Confirmar refresh mantendo a política atual.
- [ ] Qualquer desenho que afete dinheiro real/produção sem contrato aprovado deve ser `HUMAN-SENIOR`.

# 17. Admin — demais páginas visíveis

Para usuários, pedidos, transações, disputas, denúncias, configurações, auditoria e quaisquer outras rotas visíveis:

- [ ] Abrir a página.
- [ ] Identificar origem dos dados.
- [ ] Classificar como real/mock/não implementada/futura.
- [ ] Se real, testar leitura owner/admin apropriada.
- [ ] Se houver mutation real, testar autorização e persistência.
- [ ] Se for apenas shell visual, não declarar capability operacional concluída.
- [ ] Neutralizar UI enganosa somente em PR estreita e aprovada quando fizer sentido nesta fase.

# 18. Financeiro e invariantes da venda

Para pelo menos uma venda limpa de prova:

- [ ] Conferir gross amount em minor units.
- [ ] Conferir fee policy snapshot imutável.
- [ ] Conferir seller proceeds.
- [ ] Conferir platform commission quando > 0.
- [ ] Conferir `SALE_RECOGNIZED` exatamente uma vez.
- [ ] Conferir double-entry balanceado.
- [ ] Conferir idempotency key.
- [ ] Conferir `SELLER_PENDING` antes de fulfillment completo.
- [ ] Conferir transição para `SELLER_HELD` somente quando a foundation atual determinar.
- [ ] Conferir release eligibility/snapshot quando aplicável.
- [ ] Conferir `SELLER_AVAILABLE` somente conforme regra implementada.
- [ ] Não testar/representar payout/withdrawal como dinheiro real.
- [ ] Nenhuma leitura financeira cria postings.
- [ ] Nenhum replay duplica postings.
- [ ] Reconciliation ativa inesperada bloqueia conclusão/é registrada corretamente.

# 19. Fulfillment e fail-closed

- [ ] `ACTIVE/PAID` é requisito para progressões aplicáveis.
- [ ] Seller availability ocorre no ponto de orquestração aprovado para rehearsal local.
- [ ] Seller entrega.
- [ ] Buyer confirma explicitamente.
- [ ] `completeLocked()` continua exigindo reconhecimento financeiro válido.
- [ ] Cenário sem reconhecimento não completa silenciosamente.
- [ ] Reconhecimento inválido/duplicado não completa silenciosamente.
- [ ] Disputa ativa impede transições incompatíveis.
- [ ] Não criar automatic confirmation fora do contrato.
- [ ] Não inventar scheduler/worker de produção para fechar gaps arquiteturais humanos.

# 20. Permissões e isolamento de dados

Executar matriz cruzada mínima:

- [ ] Visitor → recursos públicos apenas.
- [ ] Buyer A → não acessa Buyer B.
- [ ] Buyer → não executa Seller mutation sem papel válido.
- [ ] Buyer → não executa Admin mutation.
- [ ] Seller A → não acessa Seller B.
- [ ] Seller → não executa Admin mutation.
- [ ] Admin → somente operações administrativas implementadas/permitidas.
- [ ] IDs previsíveis/trocados manualmente não quebram ownership.
- [ ] API rejeita acesso mesmo quando a UI não oferece o botão.
- [ ] Storage assinado respeita ownership/visibilidade prevista.

# 21. Casos negativos e resiliência funcional

- [ ] ID inexistente.
- [ ] Slug inexistente.
- [ ] Pedido alheio.
- [ ] Venda alheia.
- [ ] Listing alheio.
- [ ] Versão stale.
- [ ] Idempotency replay.
- [ ] Duplo clique.
- [ ] Refresh durante mutation.
- [ ] Voltar/avançar do navegador.
- [ ] Sessão expirada.
- [ ] Backend temporariamente indisponível.
- [ ] Dados inválidos.
- [ ] Estado de domínio incompatível.
- [ ] Erros exibidos sem vazar detalhes sensíveis desnecessários.
- [ ] Recovery/retry não cria duplicação silenciosa.

# 22. UI/UX e estados

- [ ] Loading state em rotas críticas.
- [ ] Empty state em listas críticas.
- [ ] Error state em rotas críticas.
- [ ] Success state coerente.
- [ ] Nenhum sucesso + erro simultâneo.
- [ ] Refresh reflete backend autoritativo.
- [ ] Botões desabilitados quando operação não é permitida.
- [ ] CTA aparentemente clicável possui ação real ou aparência não interativa.
- [ ] Breadcrumbs/links não quebram.
- [ ] Desktop principal sem overflow/quebras óbvias.
- [ ] Mobile básico em rotas críticas sem bloqueio operacional.
- [ ] Toasts/mensagens não afirmam capability inexistente.
- [ ] Conteúdo demo não se passa por dado real operacional.

# 23. Mocks, legacy e UI enganosa

- [ ] Reexecutar/consultar guardas estruturais do fluxo crítico sem mocks.
- [ ] Identificar mocks restantes fora do caminho crítico.
- [ ] Confirmar que nenhum mock possui autoridade sobre compra/venda/admin mínimo/financeiro crítico.
- [ ] Superfícies demo visíveis recebem classificação explícita.
- [ ] Remover/neutralizar apenas casos aprovados de baixo risco/alto retorno.
- [ ] Dead code só é removido com lista exata e PR isolada.
- [ ] Não executar cleanup oportunista durante QA.

# 24. Browser QA ledger

Antes da rodada final ser considerada concluída:

- [ ] Revisar todos os itens `OPEN` em `POST_FREEZE_BROWSER_QA_FINDINGS.md`.
- [ ] Revisar itens que ainda estejam `NEEDS_REPRODUCTION`; `QA-BROWSER-004` não pertence mais a esse conjunto.
- [ ] Atualizar achados corrigidos com evidência.
- [ ] Novos achados recebem ID e classificação.
- [ ] `NON_BLOCKER` não vira blocker silenciosamente.
- [ ] `FUTURE_SCOPE` não vira implementação silenciosamente.
- [ ] Chat transacional permanece `CURRENT COMMERCE GAP / NOT IMPLEMENTED / DECISION REQUIRED`; mediação e decisões pendentes continuam sem implementação.

# 25. Claude Audit Findings Ledger

- [ ] Revisar todos os findings formais contra o HEAD pós-remediação.
- [ ] Nenhum finding é `FIXED` sem PR, PR HEAD, merge SHA, CI, regressão e re-review.
- [ ] Findings humanos recebem disposição explícita `DEFERRED-HUMAN`, `FUTURE`, `ACCEPTED` ou equivalente permitido, com razão.
- [ ] `PASS2-F1` não é declarado corrigido pelo orquestrador local `FAKE_ALPHA`.
- [ ] Findings de produção/dinheiro real permanecem separados da aceitação local do Alpha.
- [ ] Nenhum dos 35 IDs finais fica sem disposição rastreável antes do handoff.

# 26. Revalidação final limpa

Depois de todas as correções aprovadas desta fase:

- [ ] Revalidar `main` remoto e SHA final.
- [ ] Full CI verde no SHA correto.
- [ ] Recriar/reinicializar rehearsal local conforme runbook.
- [ ] Executar `demo:check` completo.
- [ ] Executar fluxo público principal.
- [ ] Executar fluxo Auth principal.
- [ ] Executar ciclo Buyer completo.
- [ ] Executar ciclo Seller completo.
- [ ] Executar Admin mínimo real completo.
- [ ] Executar uma venda completa com prova financeira no banco/Ledger.
- [ ] Confirmar idempotência/replay crítico.
- [ ] Confirmar zero regressões blockers conhecidas.
- [ ] Atualizar Browser QA ledger.
- [ ] Atualizar Claude Audit Findings Ledger.
- [ ] Registrar SHA/CI/data da aceitação final.

# 27. Critério de encerramento da fase assistida por IA

Esta fase pode ser considerada pronta para `PRODUCTION_HANDOFF.md` somente quando:

- [ ] O que é real está testado e evidenciado.
- [ ] O que é bug está corrigido ou explicitamente transferido com razão.
- [ ] O que é mock/demo está identificado e não possui autoridade crítica.
- [ ] O que não é implementado está explicitamente listado.
- [ ] O que é futuro está explicitamente separado do Alpha.
- [ ] O que exige humano sênior está explicitamente separado e priorizado.
- [ ] Browser critical path está aprovado no HEAD final.
- [ ] Admin mínimo real está funcionalmente exercitado.
- [ ] Invariantes financeiras da venda foram verificadas.
- [ ] CI e rehearsal local estão verdes.
- [ ] Ledgers/documentação estão atualizados.
- [ ] Nenhum requisito de produção/dinheiro real foi falsamente declarado pronto.

# 28. Próximo passo após esta checklist

Somente depois do fechamento dos itens aplicáveis:

1. criar `PRODUCTION_HANDOFF.md`;
2. consolidar blockers humanos/produção;
3. opcionalmente criar tag imutável de handoff, se houver decisão explícita;
4. entregar repositório e pacote ao desenvolvedor sênior/Workana;
5. obter auditoria/orçamento de productionização;
6. deixar hosting, PSP production, KYC/antifraude, payout, backups/restore, observabilidade, DR, compliance/LGPD, pentest e autorização para dinheiro real sob gates próprios e revisão humana.

## Regra final

`REAL-TESTED` não significa `PRODUCTION-READY`.

A meta desta checklist é entregar ao profissional um Alpha local **demonstrável, reproduzível, auditado, funcionalmente exercitado e com todas as lacunas explicitamente classificadas**, sem esconder mocks, funcionalidades ausentes ou riscos de produção.
