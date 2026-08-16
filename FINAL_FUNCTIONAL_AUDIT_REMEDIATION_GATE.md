# LIT Buy — Final Functional Audit Remediation Gate

## Finalidade

Este documento torna explícita a etapa de **triagem e remediação dos achados** da auditoria funcional final.

Ele complementa `FINAL_FUNCTIONAL_VALIDATION_CHECKLIST.md` e deve ser lido como um gate obrigatório **entre a seção 25 — Claude Audit Findings Ledger e a seção 26 — Revalidação final limpa**.

Ele não redefine o escopo Alpha, não autoriza Phase B, não autoriza dinheiro real, não transforma `NON_BLOCKER` em blocker automaticamente e não autoriza implementação de capability futura sem decisão explícita.

## Fluxo operacional obrigatório

A sequência da auditoria funcional final passa a ser:

1. auditar cada bloco funcional;
2. registrar e classificar todos os achados do bloco antes de avançar;
3. concluir os blocos de auditoria aplicáveis;
4. executar a triagem consolidada dos achados;
5. remediar somente o que estiver aprovado para esta fase;
6. revalidar cada correção localmente e por CI aplicável;
7. atualizar os ledgers com evidência objetiva;
8. executar a revalidação final limpa;
9. preparar o handoff final.

## Regra por bloco

Ao terminar cada bloco da auditoria funcional:

- parar antes de iniciar o bloco seguinte;
- registrar o que foi testado;
- registrar o que foi `REAL-TESTED`;
- registrar `REAL-BUG`, `MOCK-DEMO`, `NOT-IMPLEMENTED`, `FUTURE-SCOPE`, `HUMAN-SENIOR` e `NOT-APPLICABLE` quando aplicável;
- persistir novos findings no ledger apropriado;
- registrar evidências relevantes, decisões pendentes e proveniência dos dados quando aplicável;
- somente então seguir para o bloco seguinte.

A documentação de um bloco não significa que todos os seus problemas foram corrigidos. Significa que os achados foram preservados e classificados para a triagem/remediação consolidada.

## Gate de triagem e remediação

Antes da `Revalidação final limpa` do checklist principal:

- [ ] Revisar todos os `QA-BROWSER-*` abertos.
- [ ] Revisar todos os findings formais ainda não encerrados do `CLAUDE_AUDIT_FINDINGS_LEDGER.md`.
- [ ] Revisar itens `REAL-BUG`, `NOT-IMPLEMENTED`, `FUTURE-SCOPE` e `HUMAN-SENIOR` encontrados no `FINAL_FUNCTIONAL_AUDIT_REPORT.md`.
- [ ] Para cada achado, definir disposição explícita: corrigir nesta fase, manter futuro, transferir para humano sênior, aceitar com justificativa ou outra disposição autorizada.
- [ ] Não implementar capability futura apenas porque foi descoberta durante Browser QA.
- [ ] Não ampliar silenciosamente o Alpha.
- [ ] Priorizar blockers que impeçam a continuação da própria auditoria.
- [ ] Para correções assistidas por IA, usar mudança mínima e PR estreita.
- [ ] Executar CI aplicável em cada PR corretiva.
- [ ] Executar validação local/browser da correção antes de considerá-la encerrada.
- [ ] Atualizar o finding para `CLOSED`/equivalente somente com evidência objetiva.
- [ ] Confirmar que nenhuma correção introduziu regressão conhecida em outro bloco.
- [ ] Deixar itens de produção/dinheiro real sob gate humano próprio.

## Exceção — blocker durante a auditoria

Um achado pode ser corrigido antes da etapa consolidada de remediação somente quando ele impedir materialmente a continuação da auditoria.

Exemplo: se o login real estiver quebrado a ponto de impedir os testes Buyer, Seller e Admin, o fluxo permitido é:

`auditar → registrar blocker → diagnosticar → corrigir em PR mínima → revalidar → documentar → retornar ao ponto exato da auditoria interrompida`.

Achados `NON_BLOCKER` que não impedem o próximo teste permanecem registrados para a etapa consolidada de remediação.

### Regra obrigatória de retorno ao trilho principal

Corrigir um blocker encontrado no meio de um bloco **não inicia uma fase geral de correções**.

Depois que o blocker for corrigido, validado e incorporado conforme a governança:

1. registrar a evidência da correção;
2. registrar qualquer finding colateral novo sem ampliar escopo automaticamente;
3. retornar ao **mesmo bloco funcional e ao mesmo ponto lógico** em que a auditoria foi interrompida;
4. continuar a bateria planejada;
5. somente entrar na remediação consolidada quando os blocos aplicáveis estiverem concluídos.

O objetivo é impedir que a auditoria se perca em desvios laterais e preservar rastreabilidade do que estava sendo testado antes da correção.

## Regra anti-loop para correções assistidas por IA

O objetivo desta fase é maximizar o que pode ser concluído com segurança antes do handoff para um desenvolvedor profissional, **sem tentar substituir a revisão humana final e sem entrar em ciclos de correção que coloquem em risco funcionalidades já testadas**.

Para qualquer correção assistida por IA:

1. **diagnosticar a causa-raiz antes de alterar código**; não corrigir apenas o sintoma quando a evidência disponível permite identificar a origem;
2. **definir escopo fechado e mínimo** para a tentativa;
3. preservar invariantes de domínio, especialmente em Auth, RBAC, pagamentos, pedidos, Ledger, saldo e reconhecimento financeiro;
4. testar o defeito específico e as áreas imediatamente adjacentes que poderiam regredir;
5. não sacrificar múltiplos itens `REAL-TESTED` para resolver um único finding;
6. se a primeira tentativa falhar, **reavaliar a causa-raiz** antes de tentar uma segunda alteração;
7. não executar sequências cegas do tipo “fix 1 → fix 2 → fix 3” sem nova evidência;
8. se a próxima tentativa exigir ampliar materialmente o escopo, tocar várias áreas críticas já validadas, refatorar arquitetura ou criar risco desproporcional, **parar**;
9. quando parar, documentar reprodução, causa conhecida ou hipótese, tentativas feitas, arquivos envolvidos, riscos e recomendação para `HUMAN-SENIOR`/DEV profissional;
10. uma correção só é considerada encerrada quando houver evidência objetiva de implementação + testes aplicáveis + CI aplicável + validação local/browser quando a superfície for funcionalmente visível;
11. CI verde é necessário quando aplicável, mas não substitui Browser QA/manual validation para comportamento visível;
12. qualquer correção que envolva produção, PSP real, dinheiro real, saque/payout, KYC, arquitetura de execução produtiva ou revisão legal continua sob gate humano próprio.

### Classificação operacional recomendada para remediação

Durante a triagem, uma correção pode ser tratada como:

- `AI-SAFE-LOW-RISK` — mudança pequena, causa-raiz clara, escopo fechado e regressão localizável;
- `AI-CAREFUL-HIGH-RISK` — pode ser assistida por IA, mas toca domínio crítico e exige validação reforçada;
- `PREPARE-FOR-DEV` — investigar, documentar e preparar evidência, mas não insistir em implementação nesta fase;
- `HUMAN-SENIOR` — exige julgamento de arquitetura, segurança, produção, jurídico/compliance ou risco que não deve ser resolvido por tentativa iterativa da IA.

Essa classificação é operacional; não substitui severidade formal de finding nem autoridade do `CLAUDE_AUDIT_FINDINGS_LEDGER.md`.

## Exemplo registrado — QA-BROWSER-004 / PR #87

Durante o Bloco 3 — Buyer, `QA-BROWSER-004` foi reproduzido de forma limpa como blocker do pagamento Alpha local.

A causa-raiz foi isolada no `FakePaymentProvider`: IDs externos baseados em contador em memória podiam ser reutilizados após restart do backend, enquanto a constraint única do banco corretamente impedia a colisão e abria reconciliação.

A correção aprovada foi mínima e limitada ao provider fake/local: ID determinístico derivado por SHA-256 da `idempotencyHash`, sem relaxar constraint, sem alterar Ledger, state machines, reconciliação, PSP real ou Phase B.

A PR #87 foi validada por testes, CI, Browser QA, persistência após `F5`, consulta ao PostgreSQL e invariantes do Ledger antes do merge.

Após o merge da PR #87, o fluxo obrigatório é **retornar ao Bloco 3 — Buyer**, não iniciar uma fase geral de remediação.

## Relação com os documentos atuais

- `FINAL_FUNCTIONAL_VALIDATION_CHECKLIST.md` continua sendo a bateria manual/operacional principal.
- `FINAL_FUNCTIONAL_AUDIT_REPORT.md` registra o resultado efetivamente observado em cada bloco.
- `FINAL_FUNCTIONAL_AUDIT_BLOCK_3_BUYER_PROGRESS.md` preserva o estado intermediário do Bloco 3 enquanto ele ainda não está encerrado.
- `POST_FREEZE_BROWSER_QA_FINDINGS.md` continua sendo o ledger dos achados manuais de Browser QA.
- `POST_FREEZE_BROWSER_QA_BUYER_ADDENDUM_2026-08-16.md` preserva as atualizações intermediárias de findings do Buyer até a reconciliação final do ledger no fechamento do bloco.
- `CLAUDE_AUDIT_FINDINGS_LEDGER.md` continua sendo a autoridade dos findings formais da auditoria Claude.
- `ALPHA_SCOPE_AND_COMPLETION_CHECKLIST.md` continua sendo a autoridade funcional máxima do Alpha.

## Critério para entrar na revalidação final

A `Revalidação final limpa` só começa quando todos os achados conhecidos e aplicáveis tiverem disposição explícita e todas as correções aprovadas para esta fase tiverem sido implementadas, testadas e documentadas.

Isso não exige que todo item futuro ou humano esteja implementado. Exige que nenhum problema conhecido fique sem classificação ou destino rastreável.

## Disposição após o fechamento do Bloco 3 — Buyer

O Bloco 3 foi formalmente encerrado com o fluxo crítico Buyer `REAL-TESTED / PASS`, sem blocker novo. Permanecem `OPEN / NON_BLOCKER` o `QA-BROWSER-007` e o `QA-BROWSER-013`; `QA-BROWSER-003` fica `CLOSED — comportamento atual revalidado`, sem atribuir sua disposição à PR #87. Multi-Seller tem cobertura automatizada/estrutural e limitação de fixture, sem alegação de prova Browser.

Este fechamento não encerra Seller/Admin, não inicia Phase B e não aprova staging, produção ou dinheiro real. Future scope e revisão humana sênior permanecem nos documentos autoritativos.

### Regra anti-repetição entre blocos

Antes de executar um item no próximo bloco: (1) verificar evidência histórica; (2) verificar se o código relevante mudou; (3) repetir browser somente se houver necessidade objetiva. Evidência `REAL-TESTED` válida não deve ser refeita arbitrariamente.
