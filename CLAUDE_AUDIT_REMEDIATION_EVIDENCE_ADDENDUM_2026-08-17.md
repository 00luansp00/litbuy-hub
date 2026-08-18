# LIT Buy — Addendum de evidência pós-PR #97 — 2026-08-17

## Papel e limites

Este addendum preserva evidência/contexto do estado remoto pós-PR #97 e da reconciliação documental. Não concorre com `ALPHA_SCOPE_AND_COMPLETION_CHECKLIST.md`, `CLAUDE_AUDIT_FINDINGS_LEDGER.md` ou `POST_FREEZE_BROWSER_QA_FINDINGS.md`; nenhuma alteração de escopo Alpha é feita nesta reconciliação. O **AUDIT BASELINE** permanece imutável em `b88e6efdc252dc9eb6afd3d90375dc3d454ce72d`; o ponto de partida pós-remediações é o merge da #97, `a4735929bee28c3320819665a399e62515c8039e`.

Não há aprovação de produção, dinheiro real, PSP produtivo, payout, split, escrow ou KYC neste registro.

## PR #95 — refresh single-flight

- PR: #95 — `fix(auth): unify refresh single-flight`.
- HEAD: `6402d6b769ac209617c4d5281df1a38d08d66585`.
- Merge: `9df43e6cd8c38ea7e771d92dddf7f05ebacd683f`.
- CI: #346 / run `32035490792` — `SUCCESS`.
- Causa: `AuthProvider → authService.refresh()` e retry 401 → `refreshAccessToken()` competiam; a segunda chamada reutilizava o predecessor rotacionado e o backend corretamente revogava a família por `REFRESH_TOKEN_REUSE`.
- Correção: uma única primitive `refreshAccessToken()` single-flight compartilhada; backend não enfraquecido.
- Revalidação: um `/auth/refresh`, HTTP 200, autenticação mantida, Session ativa, sem `revokedAt`/`revokedReason`.

Esta correção funcional de Browser QA não é inventada como finding Claude. `QA-BROWSER-009` permanece `OPEN / NON_BLOCKER` para o flash visual durante bootstrap.

## PR #96 — PASS2-F2

- PR: #96 — `fix(admin): use categoryId for listing moderation filter`.
- HEAD: `de200aa06235d633c3c5e9b266c95235a153412b`.
- Merge: `76874bf7a84135808c0ab677d9ff97ca1a446e4d`.
- CI: #348 / run `32064187807` — `SUCCESS`.
- Evidência: causa `category` versus `categoryId` confirmada; mudança estreita e teste de regressão; frontend rebuildado; “Todas as categorias” funcionou; “Jogos — Demonstração” retornou apenas matches; nenhuma mensagem “Erro ao carregar fila”.

Disposição no Ledger: `PASS2-F2 = FIXED`. Não encerra todo o bloco Admin.

## PR #97 — PASS2-F3

- PR: #97 — `fix(listing): persist notification preferences`.
- HEAD: `b8585176ebfcb2c7b49314a7d8d08c2b349fe505`.
- Merge: `a4735929bee28c3320819665a399e62515c8039e`.
- CI: #350 / run `32079416748` — `SUCCESS`.
- Causa: backend já persistia `notifyInApp`, `notifyBrowser`, `notifyEmailFuture` e `notifyExternalFuture`, mas `formStateToDraftPayload()` não os enviava.
- Correção: `DraftPayload` e adapter passaram a mapear os quatro campos, com teste específico.
- Revalidação: no mesmo draft `97d56b60-7a1c-406d-a6ea-4d359f9c8bd1`, in-app OFF/browser ON permaneceram após salvar + `F5`; DB confirmou `notifyInApp=false` e `notifyBrowser=true`.

Disposição no Ledger: `PASS2-F3 = FIXED`.

## Reconciliação do Ledger

Nesta PR documental, `P3-F1`, `PASS2-F5`, `PASS2-F2` e `PASS2-F3` recebem evidência formal e status `FIXED`. `P4-F2` registra apenas o slice local/rehearsal da PR #76 como remediado e permanece agregado `OPEN`. `P3-F10` e `PASS2-F1` permanecem `OPEN`, respectivamente por hardening/threat model amplo e por runtime/orchestration automática de produção; nenhuma evidência afirma scheduler/worker/cron produtivo.

## Regra anti-repetição

Antes de qualquer teste: **ITEM → JÁ TESTADO? → ONDE ESTÁ A EVIDÊNCIA? → CÓDIGO RELEVANTE MUDOU DEPOIS? → PRECISA REPETIR?**

Não repetir automaticamente Buyer critical flow/pagamento Alpha, Seller onboarding, ListingDraft lifecycle, Seller delivery, Seller finance, PASS2-F2, PASS2-F3 ou auth refresh #95. Revalidar apenas após mudança relevante, regressão objetiva ou rodada final deliberada. `QA-BROWSER-004` foi fechado no cenário local/`FAKE_ALPHA` por validações limpas posteriores; sua primeira tentativa contaminada continua apenas como histórico e não prova produção/PSP.

## Decisões correntes, sem implementação

- Chat transacional: `CURRENT COMMERCE GAP / NOT IMPLEMENTED / DECISION REQUIRED`; persistente, server-authoritative, vinculado ao pedido, protegido contra IDOR e historicamente acessível após `COMPLETED`, sujeito às políticas ainda pendentes.
- Seller onboarding: máximo de duas re-submissões após rejeição, bloqueio automático na terceira rejeição e orientação ao suporte, possível override Admin e terminalidade antecipada por rejeição grave — `NOT IMPLEMENTED / PRODUCT DECISION / NON_BLOCKER`.
- PSP: Mercado Pago é preferência/candidato atual Brasil/Pix, não provider homologado nem integrado. Efí permanece adapter/boundary sandbox real já construído, sem homologação produtiva. O Ledger interno continua autoridade financeira.
- Hold de e-mail: 72h após troca concluída é requisito desejado, não runtime comprovado; o runtime/default histórico observado é 48h.
