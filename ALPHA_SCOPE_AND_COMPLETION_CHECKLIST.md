# LIT Buy — Handoff Alpha v1

## Status e finalidade

Este documento é a fonte autoritativa para a linha de chegada da fase atual do Alpha. Ele preserva o escopo entre conversas, checkpoints e PRs; não substitui os contratos técnicos específicos de cada domínio.

> **FEATURE FREEZE ATIVO.** Baseline oficial: `aceb8b26b7205b03b28e0681aba9fb71a175f67f`. `PENDENTE DE IMPLEMENTAÇÃO ALPHA = 0`; a fase atual é preparação de handoff pós-freeze. Os gates ainda abertos registram trabalho não executado, mas não bloqueiam a auditoria pre-handoff read-only nem a auditoria/orçamento inicial de um profissional sênior.

> **“Finalizar aqui” significa concluir todas as implementações deliberadamente pertencentes ao Handoff Alpha v1. Não significa produção pública nem dinheiro real habilitado.**

A condição necessária para encerrar a fase atual de implementação e iniciar o feature freeze é:

`PENDENTE DE IMPLEMENTAÇÃO ALPHA = 0`

Enquanto existir qualquer item em `PENDENTE DE IMPLEMENTAÇÃO ALPHA`, é proibido iniciar auditoria geral, refatoração geral, polishing arquitetural, revisão geral por outra IA, tentativa de reinventar módulos antigos ou feature freeze prematuro. Depois do freeze, gates abertos continuam como trabalho de validação/productionização, sem bloquear a auditoria pre-handoff read-only.

## Ordem estratégica pós-freeze

`FEATURE FREEZE`
→ `REPRODUÇÃO / HANDOFF LOCAL`
→ `REPOSITORY CLARITY / DOCUMENTAÇÃO ATUAL`
→ `SANITY CHECK LIMITADO DO FLUXO CRÍTICO`
→ `CLAUDE CODE FULL-REPO AUDIT READ-ONLY`
→ `TRIAGEM DOS ACHADOS`
→ `CORREÇÕES POR IA SOMENTE DE BAIXO RISCO / ALTO RETORNO`
→ `PRODUCTION HANDOFF PACKAGE`
→ `WORKANA: AUDITORIA HUMANA SÊNIOR`
→ `ORÇAMENTO DE PRODUCTIONIZAÇÃO`
→ `IMPLEMENTAÇÃO PROFISSIONAL / PRODUÇÃO`

Não usar o fluxo incorreto:

`implementar → revisar tudo → refatorar → implementar mais → revisar novamente → perder roadmap`

## Critério de classificação

- `CONCLUÍDO` exige implementação real persistida/ligada ao backend quando isso fizer parte do contrato; UI ou mock isolado não basta.
- `PENDENTE DE IMPLEMENTAÇÃO ALPHA` contém somente funcionalidades e integrações verificadas do caminho crítico que precisam estar implementadas antes do freeze.
- `GATES DE ESTABILIZAÇÃO / HANDOFF` preserva validações operacionais ainda necessárias antes da produção; gates abertos não impedem a auditoria pre-handoff read-only nem o orçamento humano inicial.
- `FORA DO ALPHA / PRODUÇÃO` preserva blockers de produção sem fazê-los bloquear o Alpha.
- As referências a PR indicam o incremento principal, não necessariamente todo o histórico que sustenta o item.

## CONCLUÍDO

| Domínio                            | Estado                                     | PR(s) responsável(is) | Implementação real e limites                                                                                                                                                                                                                                                                                   |
| ---------------------------------- | ------------------------------------------ | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Autenticação                       | **CONCLUÍDO no escopo auditado**           | #4–#15, #17–#19       | NestJS/PostgreSQL/Redis, cadastro/login, sessões, dispositivos, senha, telefone, e-mail, 2FA, step-up e recovery codes, com frontend real. Hardening final de produção continua fora do Alpha. Ver `AUTHENTICATION_FINAL_AUDIT.md`.                                                                            |
| Marketplace / RBAC                 | **CONCLUÍDO**                              | #21                   | `BUYER`, `SELLER` e `ADMIN` persistidos; identidade e autorização server-side. A existência de gates não torna telas mockadas reais. Ver `MARKETPLACE_RBAC_FOUNDATION.md`.                                                                                                                                     |
| Seller onboarding                  | **CONCLUÍDO como foundation Alpha**        | #22                   | `SellerApplication`, `SellerProfile`, submissão, aprovação/rejeição e concessão atômica de `SELLER`, com integração frontend. `SellerProfile.verified` não é KYC real. Ver `SELLER_ONBOARDING_FOUNDATION.md`.                                                                                                  |
| Catálogo: taxonomia e anúncios     | **CONCLUÍDO**                              | #23, #25–#28          | Taxonomia persistente; listing drafts e moderação; materialização idempotente em `Product`; imagens privadas S3-compatible/MinIO; lifecycle persistente. Não implica busca, seller store ou cofre/entrega automática.                                                                                          |
| Catálogo público                   | **CONCLUÍDO**                              | #29–#34               | API pública real, Home, categoria e detalhe real, mais dados demo locais determinísticos. Compra não é habilitada apenas pela visibilidade pública.                                                                                                                                                            |
| Commerce server-side               | **CONCLUÍDO como core backend**            | #36–#38               | Carrinhos persistentes, checkout/order core, reserva de inventário, idempotência, snapshots imutáveis e leituras de pedidos do buyer. O frontend de leitura de pedidos existe; carrinho/checkout e pós-compra ainda não compõem um fluxo real completo pelo navegador.                                         |
| Fundação financeira                | **CONCLUÍDO como foundation**              | #39                   | Ledger double-entry provider-neutral e políticas versionadas. É fundação interna, não dinheiro real nem domínio financeiro completo. Ver `FINANCIAL_DOMAIN_FOUNDATION.md`.                                                                                                                                     |
| Pagamento sandbox e ativação       | **CONCLUÍDO no backend**                   | #40, #42–#46          | Adapter Efí sandbox, orquestração provider-neutral, notification ingress, processamento de eventos e ativação de pedido pago. Ainda falta um caminho Alpha utilizável pelo navegador; não há homologação/dinheiro real.                                                                                        |
| Snapshot e reconhecimento da venda | **CONCLUÍDO**                              | #47–#48               | Snapshot imutável da comissão no checkout e reconhecimento financeiro da venda paga no ledger, creditando `SELLER_PENDING`.                                                                                                                                                                                    |
| Fulfillment e fundos do seller     | **CONCLUÍDO no backend**                   | #49–#54               | Fulfillment, `SELLER_PENDING → SELLER_HELD`, política versionada, snapshot do hold, `ACTIVE → RELEASE_ELIGIBLE` e `SELLER_HELD → SELLER_AVAILABLE`. Não inclui scheduler, payout, saque ou frontend operacional.                                                                                               |
| Leitura financeira do seller       | **CONCLUÍDO no backend**                   | #55                   | APIs owner-only read-only de resumo e atividade derivadas do ledger, com buckets `PENDING`, `HELD`, `AVAILABLE`, `RESERVED` e `DEFICIT`. Frontend continua pendente.                                                                                                                                           |
| Ambiente local público             | **CONCLUÍDO como foundation reproduzível** | #27, #30, #34         | PostgreSQL, Redis e MinIO/S3-compatible reais no ambiente local, dados demo determinísticos e runbooks/rehearsal da fundação pública. A aceitação do fluxo Alpha completo e staging continuam pendentes.                                                                                                       |
| Buyer — carrinho no navegador      | **CONCLUÍDO**                              | #57–#61               | Cliente HTTP real, cache React Query, adição pela página pública real, `/carrinho` multi-seller real com leitura, update, remoção e paginação, e navegação global sem estado mock. `CartProvider` e `cartService` legacy foram removidos ao conectar o checkout real.                                          |
| Buyer — checkout real              | **CONCLUÍDO**                              | #62                   | `/carrinho` escolhe explicitamente um seller e `/checkout` lê seu carrinho real, envia somente versão/fingerprint esperados ao `POST /checkout-sessions` com idempotência estável por intenção e segue para o pedido real. Preço, estoque e transição para `CHECKED_OUT` permanecem sob autoridade do backend. |

### Limite financeiro alcançado

A cadeia construída da venda é:

`PAID`
→ `SELLER_PENDING`
→ `SELLER_HELD`
→ `RELEASE_ELIGIBLE`
→ `SELLER_AVAILABLE`

Isso fecha o núcleo financeiro da venda até saldo **internamente disponível**. Não finaliza todo o domínio financeiro e não habilita cash-out, payout ou dinheiro real.

## PENDENTE DE IMPLEMENTAÇÃO ALPHA

Cada linha abaixo bloqueia o feature freeze até ser implementada ou até uma decisão humana autoritativa alterar seu estado. O freeze começa somente quando não restar nenhuma linha aberta: `PENDENTE DE IMPLEMENTAÇÃO ALPHA = 0`.

| Domínio                           | Estado                              | PR responsável | Entrega necessária e evidência atual                                                                                                                                                                                                                                                                                 |
| --------------------------------- | ----------------------------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Buyer — pagamento Alpha           | **CONCLUÍDO**                       | #63            | Browser Buyer ligado à API autenticada, orquestração persistida e `FAKE_ALPHA` não produtivo; evento provider-neutral confirma Payment e o worker existente ativa o Order. O mock frontend foi removido. Não é pagamento real.                                                                                       |
| Buyer — pós-compra                | **CONCLUÍDO**                       | #64            | Buyer acompanha o `fulfillmentStatus` real pelo Order read model existente e usa `Confirmar recebimento` no backend real, com CSRF e `OrderFulfillmentService` como autoridade da transição. A confirmação mock saiu do caminho crítico; dispute, review, chat e demais funções legacy continuam fora deste blocker. |
| Seller — vendas e entrega         | **CONCLUÍDO**                       | #65            | Seller lista e abre vendas reais owner-only e registra entrega pelo `OrderFulfillmentService` real com CSRF, sem mock no caminho crítico e sem implementar financeiro Seller.                                                                                                                                        |
| Seller — financeiro               | **CONCLUÍDO**                       | #66            | O Seller lê os cinco buckets owner-only por summary/activity derivados do ledger real, com paginação por cursor e minor units formatadas com segurança via BigInt. O financeiro mockado saiu do caminho crítico; o Alpha não oferece saque, payout ou dinheiro real.                                                |
| Admin — operação mínima integrada | **CONCLUÍDO**                       | #67            | As três superfícies críticas — seller onboarding, moderação de `ListingDraft` e catálogo/taxonomia — usam boundaries reais, autorização `ADMIN` server-side e mutations persistidas pelo backend, com guarda contra regressão para mocks. Outras superfícies Admin permanecem fora deste blocker.                 |
| Integrações do fluxo sem mocks    | **CONCLUÍDO**                       | #68            | O caminho crítico Buyer/Seller/Admin usa boundaries reais: a Home consome `categoryService` diretamente, sem atravessar o `productService` mock, e catálogo público, detalhe, carrinho, checkout, pedidos, pagamento Alpha, fulfillment, vendas/entrega/financeiro Seller e Admin mínimo permanecem em serviços reais. Uma guarda estrutural previne regressões; mocks e demonstrações legacy restantes estão isolados fora do caminho crítico e não têm autoridade operacional no Alpha. A comprovação manual ponta a ponta completa permanece como gate pós-freeze e não foi executada nesta PR. |

Busca, seller store, favoritos, reviews, chat, afiliados, growth e painéis administrativos não indispensáveis **não são transformados automaticamente em blockers** por esta checklist. Se sua inclusão no Alpha for proposta, registrar `DECISION REQUIRED`; não ampliar o escopo silenciosamente.

## GATES DE ESTABILIZAÇÃO / HANDOFF

Estes gates permanecem abertos até que sua evidência específica exista; esta atualização não declara nenhum deles concluído. Eles registram necessidades de **productionization / human review**, mas não são pré-requisitos para iniciar o **pre-handoff / vibe-coding readiness**: reprodução local, clareza documental, sanity check limitado e auditoria Claude Code read-only. A composição staging-like e os smokes do CI são evidência técnica, não staging hospedado.

| Gate                        | Estado              | Evidência de conclusão necessária                                                                                                                             |
| --------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Revalidação local e handoff | **GATE PÓS-FREEZE** | Executar rehearsal/aceitação do ambiente local completo; consolidar instruções finais, documentação de handoff e production blockers explícitos.              |
| Staging Alpha               | **GATE PÓS-FREEZE** | Hospedar staging e validar environments, secrets não produtivos, migrations, PostgreSQL, Redis e object storage de staging.                                   |
| Observabilidade mínima      | **GATE PÓS-FREEZE** | Validar observabilidade suficiente para diagnosticar o fluxo crítico em staging, sem antecipar o stack completo de produção.                                  |
| Fluxo crítico sem mocks     | **GATE PÓS-FREEZE** | Comprovar ponta a ponta, localmente e em staging, que Buyer, Seller e Admin mínimo funcionam sem mocks no caminho crítico já implementado.                    |
| Testes e estabilização      | **GATE PÓS-FREEZE** | Executar testes manuais e E2E críticos pelo navegador, corrigir bugs objetivos e revalidar o fluxo completo. Testes atuais isolados não substituem este gate. |

## FORA DO ALPHA / PRODUÇÃO

Os itens abaixo permanecem rastreáveis e deliberadamente reservados para a fase profissional/de produção, salvo decisão posterior documentada. Não desaparecem por não bloquearem o Alpha.

| Domínio                               | Estado                       | PR responsável | Limite reservado                                                                                                               |
| ------------------------------------- | ---------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Dinheiro e payout                     | **FORA DO ALPHA / PRODUÇÃO** | futura         | Dinheiro real; cash-out/saque real; `AVAILABLE → RESERVED → payout`; destino de payout verificado; Pix-out/transferência real. |
| Identidade e risco                    | **FORA DO ALPHA / PRODUÇÃO** | futura         | KYC real e antifraude de produção. `SellerProfile.verified` não substitui KYC.                                                 |
| PSP                                   | **FORA DO ALPHA / PRODUÇÃO** | futura         | Homologação final do PSP e operação produtiva; o adapter sandbox não equivale a homologação.                                   |
| Exceções financeiras                  | **FORA DO ALPHA / PRODUÇÃO** | futura         | Refund, chargeback e disputa financeira completos; reconciliação operacional completa.                                         |
| Segurança e governança de repositório | **FORA DO ALPHA / PRODUÇÃO** | futura         | Segurança final de produção, hardening completo da Issue #41, branch protection/required checks, secrets finais e pentest.     |
| Confiabilidade operacional            | **FORA DO ALPHA / PRODUÇÃO** | futura         | Observabilidade completa, backups, teste real de restore e disaster recovery.                                                  |
| Infra e escala                        | **FORA DO ALPHA / PRODUÇÃO** | futura         | Infraestrutura final e performance final.                                                                                      |
| Compliance e lançamento               | **FORA DO ALPHA / PRODUÇÃO** | futura         | LGPD, jurídico, revisão humana sênior e aprovação final para lançamento.                                                       |

## Auditorias e production handoff

### Claude Code pre-handoff audit

Depois da reprodução/handoff local, repository clarity e sanity check limitado do fluxo crítico, uma IA independente — Claude Code ou equivalente — pode realizar uma auditoria full-repo inicialmente **read-only**, antes da Workana. Hosted staging, observabilidade hospedada, browser E2E completo e o fechamento de todos os gates não são pré-requisitos para iniciar essa auditoria.

O objetivo é compreender e auditar arquitetura, funcionalidade, segurança, autenticação/RBAC, isolamento Buyer/Seller/Admin, pagamentos/webhooks, ledger e invariantes financeiras; identificar dead code, documentação stale e production blockers; e produzir um relatório que reduza horas humanas de descoberta. A IA não tem autoridade automática para alterar código, criar branch/commit/PR, refatorar, mudar arquitetura ou implementar recomendações. Essa auditoria **não certifica segurança para produção**.

### Triagem dos achados

Nenhuma recomendação da IA vira código automaticamente. Cada apontamento deve ser confrontado com arquitetura, documentação autoritativa, migrations, constraints e testes, recebendo uma classificação: válido e corrigível agora; válido mas reservado à produção; melhoria opcional; falso positivo; ou incompatível com decisão deliberada. Somente correções aprovadas de baixo risco e alto retorno voltam por PR pequena e CI normal.

### Workana / human senior audit

A revisão humana sênior paga ocorre antes de dinheiro real e tem foco especial em segurança. Ela valida o estado real, determina o trabalho necessário para produção, produz estimativa/orçamento e pode posteriormente executar a productionização. Segurança final, especialmente para dinheiro real, **não pode depender apenas da conclusão de IA**.

Staging hospedado, observabilidade, browser E2E completo e infraestrutura final continuam importantes antes da produção, mas podem ser recomendações das auditorias, itens do production handoff ou milestones da contratação profissional; não bloqueiam a auditoria Claude Code nem a auditoria/orçamento humano inicial.

O objetivo do processo é entregar ao profissional um repositório funcional, claro e reproduzível, com arquitetura compreensível, CI, evidências disponíveis, relatório técnico triado e blockers explícitos — reduzindo descoberta sem gastar tempo em infraestrutura que o profissional poderá decidir ou substituir.

## Governança de PRs mergeadas

Uma PR mergeada é considerada concluída. Não voltar a PRs ou domínios antigos apenas porque surgiu uma ideia “melhor”. Reabrir somente por bug objetivo, risco de segurança, risco de integridade, contradição comprovada ou bloqueio real para implementação posterior.

Melhoria estética, refatoração opcional ou arquitetura alternativa: `NÃO AGORA`. Registrar como dívida/futuro e continuar o Alpha.

## Política REPARAR vs. RECONSTRUIR

Regra consolidada a partir do aprendizado da PR #55.

### REPARAR

Continuar na mesma PR quando:

- a arquitetura base e o escopo continuam corretos;
- o defeito é localizado;
- rota, DTO, fixture, teste, lint, formatação ou condição específica podem ser corrigidos de modo auditável;
- a correção não exige espalhar mudanças pelo sistema.

### RECONSTRUIR

Abandonar a PR **sem merge** e reconstruir a partir do `main` quando:

- o contrato fundamental foi interpretado errado ou a arquitetura está errada;
- cada correção quebra outro domínio;
- o escopo cresce de maneira descontrolada;
- a solução acumula exceções/remendos ou perdeu auditabilidade;
- risco financeiro, ownership, concurrency ou idempotência foi desenhado incorretamente.

Ao reconstruir, não esquecer o aprendizado: o novo prompt deve incorporar contrato correto, invariantes, bugs encontrados, testes necessários e coisas que não podem se repetir.

Depois de aproximadamente três rodadas relevantes de correções funcionais/arquiteturais na mesma PR, fazer a avaliação explícita `REPARAR ou RECONSTRUIR?`. Lint, Prettier e ajustes mecânicos não contam como falhas estruturais. Não remendar indefinidamente nem descartar cedo demais uma PR estruturalmente saudável.

## Continuação de PR em novo contexto do Codex

Nunca entregar apenas “continue essa PR”. Fornecer um pacote de reparo com:

- número da PR, branch e HEAD;
- objetivo original e estado correto existente;
- falha exata e causa raiz confirmada;
- arquivos permitidos e arquivos/domínios proibidos;
- correção esperada e testes obrigatórios;
- instruções explícitas para não refatorar nem ampliar escopo.

## Regra contra duas verdades

Antes de introduzir decisão em domínio existente, verificar documentação e implementação anterior. Ao encontrar arquivo A dizendo X e arquivo B dizendo Y, decisão antiga contradizendo a nova, documentação stale ainda apresentada como atual ou regras concorrentes, não escolher silenciosamente.

Procedimento obrigatório:

`CONFLITO DETECTADO`
→ `REPORTAR`
→ `DECISÃO HUMANA`
→ `DEFINIR FONTE AUTORITATIVA`
→ `SÓ DEPOIS ALTERAR`

Não apagar automaticamente documentação antiga. Quando ela precisar permanecer, marcá-la como histórica, superseded ou não autoritativa, conforme apropriado. Dúvidas que exigem nova decisão devem ser registradas como `DECISION REQUIRED`, sem implementação.
