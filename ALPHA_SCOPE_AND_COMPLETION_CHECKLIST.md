# LIT Buy — Handoff Alpha v1

## Status e finalidade

Este documento é a fonte autoritativa para a linha de chegada da fase atual do Alpha. Ele preserva o escopo entre conversas, checkpoints e PRs; não substitui os contratos técnicos específicos de cada domínio.

> **“Finalizar aqui” significa concluir todas as implementações deliberadamente pertencentes ao Handoff Alpha v1. Não significa produção pública nem dinheiro real habilitado.**

A condição necessária para encerrar a fase atual de implementação é:

`PENDENTE PARA ALPHA = 0`

Enquanto existir qualquer item em `PENDENTE PARA ALPHA`, é proibido iniciar auditoria geral, refatoração geral, polishing arquitetural, revisão geral por outra IA, tentativa de reinventar módulos antigos ou feature freeze prematuro.

## Ordem oficial das fases

`IMPLEMENTAR TODO O ESCOPO DO ALPHA`
→ `PENDENTE PARA ALPHA = 0`
→ `FEATURE FREEZE`
→ `ESTABILIZAÇÃO LOCAL`
→ `STAGING`
→ `E2E / TESTES DO FLUXO COMPLETO`
→ `CORREÇÃO DE BUGS OBJETIVOS`
→ `HANDOFF ALPHA V1 ESTÁVEL`
→ `AUDITORIA EXTERNA READ-ONLY`
→ `TRIAGEM DOS ACHADOS`
→ `CORREÇÕES APROVADAS VIA CODEX/PR NORMAL`
→ `REVALIDAÇÃO`
→ `FREELANCER SÊNIOR`
→ `PRODUÇÃO`

Não usar o fluxo incorreto:

`implementar → revisar tudo → refatorar → implementar mais → revisar novamente → perder roadmap`

## Critério de classificação

- `CONCLUÍDO` exige implementação real persistida/ligada ao backend quando isso fizer parte do contrato; UI ou mock isolado não basta.
- `PENDENTE PARA ALPHA` contém somente lacunas verificadas do caminho crítico já decidido e os gates operacionais necessários antes do freeze.
- `FORA DO ALPHA / PRODUÇÃO` preserva blockers de produção sem fazê-los bloquear o Alpha.
- As referências a PR indicam o incremento principal, não necessariamente todo o histórico que sustenta o item.

## CONCLUÍDO

| Domínio                            | Estado                                     | PR(s) responsável(is) | Implementação real e limites                                                                                                                                                                                                                                           |
| ---------------------------------- | ------------------------------------------ | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Autenticação                       | **CONCLUÍDO no escopo auditado**           | #4–#15, #17–#19       | NestJS/PostgreSQL/Redis, cadastro/login, sessões, dispositivos, senha, telefone, e-mail, 2FA, step-up e recovery codes, com frontend real. Hardening final de produção continua fora do Alpha. Ver `AUTHENTICATION_FINAL_AUDIT.md`.                                    |
| Marketplace / RBAC                 | **CONCLUÍDO**                              | #21                   | `BUYER`, `SELLER` e `ADMIN` persistidos; identidade e autorização server-side. A existência de gates não torna telas mockadas reais. Ver `MARKETPLACE_RBAC_FOUNDATION.md`.                                                                                             |
| Seller onboarding                  | **CONCLUÍDO como foundation Alpha**        | #22                   | `SellerApplication`, `SellerProfile`, submissão, aprovação/rejeição e concessão atômica de `SELLER`, com integração frontend. `SellerProfile.verified` não é KYC real. Ver `SELLER_ONBOARDING_FOUNDATION.md`.                                                          |
| Catálogo: taxonomia e anúncios     | **CONCLUÍDO**                              | #23, #25–#28          | Taxonomia persistente; listing drafts e moderação; materialização idempotente em `Product`; imagens privadas S3-compatible/MinIO; lifecycle persistente. Não implica busca, seller store ou cofre/entrega automática.                                                  |
| Catálogo público                   | **CONCLUÍDO**                              | #29–#34               | API pública real, Home, categoria e detalhe real, mais dados demo locais determinísticos. Compra não é habilitada apenas pela visibilidade pública.                                                                                                                    |
| Commerce server-side               | **CONCLUÍDO como core backend**            | #36–#38               | Carrinhos persistentes, checkout/order core, reserva de inventário, idempotência, snapshots imutáveis e leituras de pedidos do buyer. O frontend de leitura de pedidos existe; carrinho/checkout e pós-compra ainda não compõem um fluxo real completo pelo navegador. |
| Fundação financeira                | **CONCLUÍDO como foundation**              | #39                   | Ledger double-entry provider-neutral e políticas versionadas. É fundação interna, não dinheiro real nem domínio financeiro completo. Ver `FINANCIAL_DOMAIN_FOUNDATION.md`.                                                                                             |
| Pagamento sandbox e ativação       | **CONCLUÍDO no backend**                   | #40, #42–#46          | Adapter Efí sandbox, orquestração provider-neutral, notification ingress, processamento de eventos e ativação de pedido pago. Ainda falta um caminho Alpha utilizável pelo navegador; não há homologação/dinheiro real.                                                |
| Snapshot e reconhecimento da venda | **CONCLUÍDO**                              | #47–#48               | Snapshot imutável da comissão no checkout e reconhecimento financeiro da venda paga no ledger, creditando `SELLER_PENDING`.                                                                                                                                            |
| Fulfillment e fundos do seller     | **CONCLUÍDO no backend**                   | #49–#54               | Fulfillment, `SELLER_PENDING → SELLER_HELD`, política versionada, snapshot do hold, `ACTIVE → RELEASE_ELIGIBLE` e `SELLER_HELD → SELLER_AVAILABLE`. Não inclui scheduler, payout, saque ou frontend operacional.                                                       |
| Leitura financeira do seller       | **CONCLUÍDO no backend**                   | #55                   | APIs owner-only read-only de resumo e atividade derivadas do ledger, com buckets `PENDING`, `HELD`, `AVAILABLE`, `RESERVED` e `DEFICIT`. Frontend continua pendente.                                                                                                   |
| Ambiente local público             | **CONCLUÍDO como foundation reproduzível** | #27, #30, #34         | PostgreSQL, Redis e MinIO/S3-compatible reais no ambiente local, dados demo determinísticos e runbooks/rehearsal da fundação pública. A aceitação do fluxo Alpha completo e staging continuam pendentes.                                                               |

### Limite financeiro alcançado

A cadeia construída da venda é:

`PAID`
→ `SELLER_PENDING`
→ `SELLER_HELD`
→ `RELEASE_ELIGIBLE`
→ `SELLER_AVAILABLE`

Isso fecha o núcleo financeiro da venda até saldo **internamente disponível**. Não finaliza todo o domínio financeiro e não habilita cash-out, payout ou dinheiro real.

## PENDENTE PARA ALPHA

Cada linha abaixo é um blocker até ser implementada e validada ou até uma decisão humana autoritativa alterar seu estado. A contagem chega a zero somente quando não restar nenhuma linha aberta.

| Domínio                            | Estado                  | PR responsável | Entrega necessária e evidência atual                                                                                                                                                                                                                                                                                              |
| ---------------------------------- | ----------------------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Buyer — carrinho real no navegador | **PENDENTE PARA ALPHA** | futura         | Conectar a experiência do carrinho ao `CartsModule` persistente. `src/services/cartService.ts` permanece mockado.                                                                                                                                                                                                                 |
| Buyer — checkout real              | **PENDENTE PARA ALPHA** | futura         | Conectar o frontend de checkout ao commerce backend real, preservando idempotência, reserva e snapshots. `src/services/checkoutService.ts` ainda simula criação de pedido.                                                                                                                                                        |
| Buyer — pagamento Alpha            | **PENDENTE PARA ALPHA** | futura         | Oferecer pelo navegador pagamento fake/sandbox seguro e utilizável, ligado à orquestração backend e à ativação do pedido; `src/services/paymentService.ts` permanece 100% mockado. Não é pagamento real.                                                                                                                          |
| Buyer — pós-compra                 | **PENDENTE PARA ALPHA** | futura         | Ligar acompanhamento, entrega e confirmação explícita de recebimento ao order/fulfillment backend. As leituras básicas existem, mas `src/services/orderService.ts` ainda simula ações de pós-compra.                                                                                                                              |
| Seller — vendas e entrega          | **PENDENTE PARA ALPHA** | futura         | Ligar as telas de venda/entrega ao fluxo real de fulfillment, incluindo a progressão observável da venda. `src/services/sellerSaleService.ts` ainda é mockado.                                                                                                                                                                    |
| Seller — financeiro                | **PENDENTE PARA ALPHA** | futura         | Fazer o frontend consumir as APIs owner-only de resumo/atividade da PR #55 e representar corretamente `PENDING`, `HELD` e `AVAILABLE`, sem sugerir saque real. A tela atual usa dados mockados.                                                                                                                                   |
| Admin — operação mínima integrada  | **PENDENTE PARA ALPHA** | futura         | Validar e completar somente as superfícies reais indispensáveis ao caminho crítico: seller onboarding, moderação e catálogo/anúncios. Partes do admin continuam explicitamente mockadas; módulos não críticos não viram blocker automaticamente.                                                                                  |
| Fluxo crítico sem mocks            | **PENDENTE PARA ALPHA** | futura         | Demonstrar no navegador Buyer (auth → catálogo → produto → carrinho → checkout → pagamento Alpha → pedido → acompanhamento → recebimento), Seller (onboarding → anúncio → publicação → venda → entrega → `PENDING` → `HELD` → `AVAILABLE` → financeiro) e o suporte Admin mínimo. O caminho principal não pode depender de mocks. |
| Execução e handoff local           | **PENDENTE PARA ALPHA** | futura         | Revalidar ambiente local reproduzível e consolidar instruções claras para executar o fluxo completo com PostgreSQL, Redis e object storage reais; concluir a documentação de handoff e a lista explícita de production blockers. A foundation local já existe, mas a aplicação Alpha completa ainda não foi aceita.               |
| Staging Alpha                      | **PENDENTE PARA ALPHA** | futura         | Hospedar staging e configurar/validar environments, secrets não produtivos, migrations, PostgreSQL, Redis e object storage de staging. Não há evidência versionada de staging hospedado e validado para o fluxo completo.                                                                                                         |
| Observabilidade Alpha              | **PENDENTE PARA ALPHA** | futura         | Definir e validar observabilidade mínima suficiente para diagnosticar o fluxo crítico em staging, sem antecipar o hardening/stack completo de produção.                                                                                                                                                                           |
| Testes do fluxo completo           | **PENDENTE PARA ALPHA** | futura         | Após o feature freeze, executar testes manuais e E2E críticos pelo navegador em staging, corrigir bugs objetivos e registrar a estabilização do Handoff Alpha v1. Testes unitários/integrados atuais não provam esse fluxo E2E.                                                                                                   |

Busca, seller store, favoritos, reviews, chat, afiliados, growth e painéis administrativos não indispensáveis **não são transformados automaticamente em blockers** por esta checklist. Se sua inclusão no Alpha for proposta, registrar `DECISION REQUIRED`; não ampliar o escopo silenciosamente.

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

## Auditoria externa: momento e protocolo fixos

A auditoria externa geral **não ocorrerá** enquanto houver `PENDENTE PARA ALPHA`. Quando `PENDENTE PARA ALPHA = 0`, ocorre feature freeze e, nesta ordem:

1. estabilização local;
2. staging;
3. testes manuais;
4. E2E;
5. correção de bugs óbvios;
6. congelamento do Handoff Alpha v1 estável.

Somente então ocorre a auditoria externa.

Uma IA independente, preferencialmente Claude/Anthropic ou equivalente no momento da auditoria, atua estritamente como `AUDITOR READ-ONLY`. Ela não tem autoridade para alterar código, criar branch, criar commit, abrir PR, refatorar, mudar arquitetura, substituir decisões deliberadas ou implementar recomendações.

O resultado deve ser um relatório técnico. Para cada achado, idealmente: arquivo/linha, comportamento atual, evidência, cenário de reprodução, risco, severidade, correção mínima sugerida e indicação se considera production blocker.

## Triagem da auditoria

Nenhuma recomendação externa vira código automaticamente. Cada apontamento deve ser confrontado com GitHub remoto, arquitetura, documentação autoritativa, migrations, constraints, testes e decisões deliberadas, recebendo uma classificação:

- válido e precisa corrigir;
- válido, mas pertence à produção/futuro;
- melhoria opcional;
- falso positivo;
- contradiz decisão arquitetural deliberada.

Somente itens aprovados voltam ao Codex, sempre por PR pequena e CI normal. Depois pode haver apenas uma segunda conferência curta do auditor para verificar os próprios achados; não iniciar outra reescrita geral.

## Handoff para freelancer sênior

O objetivo não é eliminar revisão humana, mas reduzir horas humanas gastas em trabalho que pode ser concluído antes. O freelancer deve idealmente receber repositório funcional, staging, documentação, CI, E2E, arquitetura, Handoff Alpha v1, relatório da auditoria externa, correções triadas e production blockers explícitos.

Priorizar as horas humanas para revisão técnica final, segurança, infraestrutura, PSP de produção, KYC, payout, antifraude, observabilidade, backups/restore, secrets, performance, LGPD/jurídico e lançamento.

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
