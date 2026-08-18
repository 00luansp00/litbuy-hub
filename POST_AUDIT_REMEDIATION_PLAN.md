# LIT Buy — Plano de remediação pós-auditoria Claude

O feature freeze continua **ATIVO**. Findings não autorizam implementação automática: esta PR documental precede qualquer fix, e nenhuma correção de `P3-F1` ou `PASS2-F5` está autorizada aqui.

**AUDIT BASELINE** é permanentemente `b88e6efdc252dc9eb6afd3d90375dc3d454ce72d`. Um futuro **POST-AUDIT REMEDIATION HEAD** será o HEAD corrente de `main` após remediações e não alterará retroativamente o snapshot auditado.

## Princípios

- Mudança mínima; uma capability auditável por PR; não misturar domínios.
- Sem mega-refactor, scope creep, opportunistic cleanup ou feature nova.
- O GitHub remoto prevalece sobre resumos de agentes para branch, HEAD, código, PR, diff, CI e merge.
- CI verde não substitui diff review; toda PR deve ser re-revisada.
- Repairs de branch/PR aberta permanecem na mesma PR quando possível.
- Merge somente após autorização humana inequívoca.
- Nenhuma PR pós-auditoria está concluída sem atualizar o [`CLAUDE_AUDIT_FINDINGS_LEDGER.md`](./CLAUDE_AUDIT_FINDINGS_LEDGER.md).
- `found_in` permanece o audit baseline; depois de fix, registrar `fixed_by_pr`, `merge_sha` e `validated_at` sem alegar que o novo SHA foi auditado originalmente.

## Fase A — bugs que impedem demonstração real do Alpha

1. `P3-F1`: CSRF, somente após decisão humana e formalização do threat model.
2. `PASS2-F5`: fulfillment availability, após decisão do ponto correto de orquestração.
3. `P4-F2`: somente o subproblema de configuração/wiring do rehearsal local/`FAKE_ALPHA`; isso não resolve o slice de PSP de produção nem fecha o finding inteiro.
4. Revalidar o browser critical flow.

Nesta fase futura, não remover CSRF por conveniência e não chamar `makeAvailable()` no primeiro lugar que compilar. Nenhum desses patches começa nesta PR.

## Fase B — defeitos pequenos

5. `PASS2-F2`.
6. `PASS2-F3`, somente se a UI continuar em escopo.

## Fase C — neutralizar UI enganosa

7. `P5-F2`.
8. `P5-F1`, após decisão entre identidade Seller real e shell neutra.
9. `P5-F4`.
10. Demais superfícies demo/hardcoded, conforme decisão explícita.

## Fase D — jobs, documentação e hardening baratos

11. `P4-F5`.
12. `P5-F3`, somente após decisão humana de autoridade, seguindo: `CONFLITO DETECTADO` → `DECISÃO HUMANA` → `FONTE AUTORITATIVA` → `ATUALIZAR DOCS + INDEX + CI EM CONJUNTO`.
13. Básicos de `P3-F6`; CSP final exige revisão.
14. `P3-F9`.
15. `P4-F13`.
16. `P4-F14`.

## Fase E — dead code

17. `P5-F5` em PR(s) isoladas, somente após aprovação de lista exata de exclusão.

## Fase F — revalidação

18. Full CI no HEAD correto.
19. Browser acceptance do critical path.
20. Staging-like rehearsal.
21. Atualizar o Ledger com PR, HEAD, merge, CI, regressão, re-review e residual scope.
22. Confirmar que nenhum finding ficou sem disposição.

## Fase G — handoff

Somente depois das fases e gates aplicáveis:

23. Criar `PRODUCTION_HANDOFF.md`.
24. Eventualmente criar tag imutável, se o estado justificar.
25. Entregar ao humano sênior/Workana.

Não criar o handoff nem tag nesta tarefa.

## Backlog humano/infra

`PASS2-F1`, `PASS2-F4`, `P3-F10`, `P3-F2`/`P3-F3`/`P3-F4`/`P3-F7`/`P3-F8`, `P4-F1`/`P4-F4`/`P4-F6`/`P4-F7`/`P4-F8`/`P4-F9`/`P4-F10`/`P4-F11`/`P4-F15`, `P5-F1` e `P5-F3` não devem ser “resolvidos por IA automaticamente”. O mesmo vale para hosting, deploy, secrets, observability, backup/restore, DR, KYC, antifraud, payout, PSP production, compliance e pentest.

## Dinheiro real

O projeto **não está autorizado para dinheiro real**. Este plano não autoriza implementar ou habilitar PSP production, Pix/boleto/cartão reais, payout, withdrawal, cash-out, transfer, settlement operacional, refund/chargeback operacionais, KYC, antifraude, escrow real ou real-money release. Foundations e schema não comprovam capability operacional.

## Reconciliação de execução após PR #97 — 2026-08-17

As listas de fases acima preservam a sequência histórica. O estado corrente é:

- `P3-F1` e o defeito específico de `PASS2-F5` foram concluídos com a evidência formal registrada no Ledger; `P3-F10` e `PASS2-F1` permanecem separados e `OPEN`.
- o slice local/rehearsal de `P4-F2` foi remediado pela PR #76, mas o finding agregado continua `OPEN` para produção/PSP/dinheiro real;
- `PASS2-F2` foi concluído pela PR #96, com CI #348 / run `32064187807` e Browser QA;
- `PASS2-F3` foi concluído pela PR #97, com CI #350 / run `32079416748` e Browser QA/DB.

O passo imediatamente posterior à #97 é esta reconciliação documental. Ela não inicia Phase C nem qualquer próxima fase de implementação, não autoriza feature e não altera o escopo Alpha.

## Decisão controlada pós-PR #98 — chat transacional — 2026-08-18

Após a reconciliação documental das PRs #97/#98, o owner autorizou a implementação mínima do chat pós-compra vinculado ao `Order` antes do Production Handoff. É um incremento deliberado pós-feature-freeze, não um finding Claude novo, não muda silenciosamente o escopo/conclusão do Alpha e permanece `AUTHORIZED PRE-HANDOFF COMMERCE INCREMENT / IMPLEMENTATION PENDING`.

O incremento deve ser resolvido antes de prosseguir para a Phase C histórica deste plano e segue a divisão controlada: PR A de contrato/documentação; PR B de backend persistente REST, ownership/IDOR e testes, sem mudança financeira; PR C de frontend real e substituição do mock no caminho do `Order`; PR D de validação funcional e reconciliação de evidências. A Phase C só continua depois do fechamento ou de nova decisão explícita sobre este incremento.

O contrato autoritativo está em [`ORDER_CHAT_CONTRACT.md`](./ORDER_CHAT_CONTRACT.md). Nenhuma dessas PRs afeta PSP, habilita dinheiro real ou permite que mensagens alterem Payment, Order, fulfillment ou Ledger.
