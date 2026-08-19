# Owner commercial, financial and Seller decision freeze — 2026-08-18

**Classificação:** `OWNER-AUTHORIZED TARGET CONTRACT` · `PRE-HANDOFF DECISION FREEZE`
**Implementação:** `NOT IMPLEMENTED` onde aplicável; não prova implementação, homologação ou production readiness.

## Autoridade e limites

Este contrato congela decisões do Owner. Não altera silenciosamente `ALPHA_SCOPE_AND_COMPLETION_CHECKLIST.md`, que continua a maior autoridade de escopo Alpha. Código, migrations, testes e documentos de implementação continuam determinando `CURRENT IMPLEMENTATION`. Em conflito com planning/target anterior, este freeze prevalece apenas nas decisões explicitamente substituídas aqui. PSP/split/escrow real, chargeback/PSP fee, KYC/biometria/retenção, antifraude, infraestrutura/providers, backups/RPO/RTO, observabilidade, filas, analytics, jurídico/LGPD, Buyer KYC/withdrawal, buckets finais, permissões granulares e schemas finais seguem `DESIGN REQUIRED`/`HUMAN-PROD-REVIEW`.

Documentos da auditoria Claude, ledgers de findings, evidências de remediação, relatórios de auditoria funcional, evidências de Browser QA e checkpoints datados preservam fatos, status e evidências do respectivo corte temporal. Eles continuam autoridades dentro desse escopo de auditoria/evidência, mas não são autoridade para um target de produto posterior quando um Owner Decision Freeze explícito e mais recente substitui aquele target. Nunca reescrever evidência histórica para fazer um target posterior parecer existente no baseline auditado.

Ao implementar capabilities futuras, aplicar esta separação:

- `CURRENT IMPLEMENTATION` → código, migrations, testes e documentação corrente de implementação;
- `CURRENT OWNER TARGET` → contrato target autorizado pelo Owner/Decision Freeze aplicável mais recente;
- `HISTORICAL/AUDIT EVIDENCE` → documentos de auditoria, findings e evidências, limitados ao corte temporal documentado.

Valores administráveis são **BASELINE INICIAL**, não hardcode. Nova configuração versionada não recalcula retroativamente snapshots comerciais/financeiros congelados.

## Seller release — OWNER TARGET / NOT IMPLEMENTED

Policy resolvida no checkout e congelada no Order: `SUBCATEGORY > CATEGORY > DEFAULT`. Default global inicial: **7 dias**; overrides podem ser menores, iguais ou maiores. Labels não são autoridade: usar IDs/relações estáveis/classificação financeira.

```text
deliveredAt = server timestamp da aceitação legítima de Seller "ENTREGUE"
baseReleaseEligibleAt = deliveredAt + frozenBaseDelay
```

Não usar clique client-side, compra ou confirmação Buyer como início normal. Compra dia 1, entrega dia 3, prazo 7: conta do dia 3. Inércia Buyer não retém indefinidamente. Disputa/blocker prevalece. “Reportar problema” é vitalício: `REPORTING WINDOW != FINANCIAL PROTECTION WINDOW`.

Baseline: Moedas virtuais/Gold/Ouro/Itens 4 dias; contas com e-mail não verificado 4; Cursos/Guias/Ebooks 4; contas/powerlevel/serviços 7; fallback 7. Admin versiona default/categoria/subcategoria/mapping, vigência, publicação, actor/timestamp/auditoria, sem retroatividade.

**SUPERSEDED FOR TARGET:** relógio em `COMPLETED`; aceleração genérica de 50%; confirmação + rating positivo como condição financeira; aceleração por categoria. Rating não tem efeito financeiro e é separado de confirmação. Só Seller MAX antecipa.

## Seller MAX — TARGET / NOT IMPLEMENTED

Add-on opcional do Seller por anúncio; não é Buyer plan, assinatura nem saque acelerado. Custa **2,99%** do produto somente se vender, descontado do Seller (nunca do Buyer), coexiste com tier, dá +50% Seller LP, e inclui targets de estoque automático, templates/mensagens permitidos e proteção operacional ampliada sem retirar proteção básica.

Só antecipa se `buyerConfirmedAt <= deliveredAt + 48 horas corridas`. Se `buyerConfirmedAt > deliveredAt + 48 horas corridas`, o benefício MAX daquela venda expirou, confirmação tardia não o reativa e `effectiveReleaseAt = baseReleaseEligibleAt`.

```text
blocks = floor(frozenBaseDelayDays / 7)
maxReductionDays = blocks * 2
maxTargetAt = deliveredAt + (frozenBaseDelayDays - maxReductionDays)
effectiveReleaseAt = MIN(baseReleaseEligibleAt, MAX(maxTargetAt, buyerConfirmedAt))
```

Exemplos base → redução → resultado: `4→0→4`, `6→0→6`, `7→2→5`, `10→2→8`, `13→2→11`, `14→4→10`, `20→4→16`, `21→6→15`. Sem confirmação válida, `effectiveReleaseAt = baseReleaseEligibleAt`. Confirmação não libera retroativamente; MAX pode antecipar, nunca atrasar. Cálculo é determinístico/server-side; blocker prevalece.

## Order Chat notices — TARGET / NOT IMPLEMENTED

Após PAID/chat elegível: prazo congelado, contagem após entrega autoritativa, presença de MAX, janela de 48h e “Reportar problema”. Após entrega: notice novo com `deliveredAt`, `baseReleaseEligibleAt`, e, se MAX, `maxTargetAt`/deadline. Confirmação válida gera notice imutável com `effectiveReleaseAt`; expiração pode gerar notice mantendo prazo normal. Notices são backend-authoritative, persistentes, imutáveis, idempotentes, sem sender falso, versionados/configuráveis, apenas templates/eventos/variáveis permitidos, sem HTML/script arbitrário.

## Tiers e fees — TARGET / NOT IMPLEMENTED

Todo anúncio vendável escolhe exatamente um `PROMOTION/LISTING TIER`: **PRATA 9,99%**, **OURO 11,99%**, **DIAMANTE 12,99%**. Incidem no produto e são descontados do Seller, não acrescidos ao Buyer. Listing tier != Seller level/reputation. Exemplo apenas ilustrativo: R$100 − Diamante R$12,99 − MAX R$2,99 = R$84,02 antes de outros componentes; não define PSP/refund/impostos.

Refund total reverte tarifas percentuais próprias relativas à parcela revertida; parcial reverte proporcionalmente, incluindo tier/MAX/componentes próprios aplicáveis. Não presume devolução de PSP fee e não define `SELLER_DEFICIT` como bruto do Order.

## Buyer VIP — TARGET / NOT IMPLEMENTED

Escolha explícita, sem dark pattern/preseleção paga:

| Opção | Taxa pós-descontos | Buyer LP | Triagem | Refund já autorizado/com recursos | Suporte |
|---|---:|---:|---|---|---|
| Sem plano | 0 | padrão | até 2 dias úteis | padrão | padrão |
| VIP Básico | 2,99% | +30% | 6 horas úteis | 12 horas corridas | 30 dias |
| VIP Premium | 4,99% | +80% | 1 hora útil | 6 horas corridas | 60 dias |

Dias úteis: segunda–sexta, excluindo feriados conforme futuro calendário. VIP prioriza operação, não direito de reclamar; 6h/1h não limita reporting. Refund acelerado exige decisão/autorização concluída e recursos disponíveis/recuperados; recovery pendente continua recovery. Não anunciar benefício sem enforcement.

## LIT Points — TARGET / NOT IMPLEMENTED

Recompensa interna, não dinheiro/saldo, não sacável/transferível. Buyer só ganha por meio monetário real homologado. Base é produto após descontos, sem reincluir VIP/MAX/tier/PSP/taxas; arredondar para baixo: sem VIP `floor(valor*1)`, Básico `floor(valor*1,30)`, Premium `floor(valor*1,80)`. R$1 = 1 LP. Compra integral em LP gera 0 Buyer LP; pagamento misto não existe.

Seller sem MAX: 0 LP. Com MAX: `base=floor(valor/2)` e `floor(base*1,50)`: R$100 = 75 LP, inclusive se Buyer pagar em LP; sem MAX = 0.

100 LP = R$1 de compra interna; pagamento em LP é 100% (R$100 = 10.000 LP) ou indisponível. LIT Buy assume resgate; Seller permanece em BRL/taxas. Lotes expiram 3 meses calendário desde AVAILABLE, não PENDING; consumo FEFO. Refund monetário reverte LP proporcional; refund em LP devolve LP, não dinheiro, com novo prazo de 3 meses desde nova disponibilidade. Foundation deve ser ledger/histórico persistente, nunca simples `user.points`; PENDING→AVAILABLE/schema/engine seguem `DESIGN REQUIRED`.

## Seller onboarding/verification

**CURRENT:** application + Admin approval/rejection continuam implementados; `verified=false` não é KYC.

**OWNER TARGET / NOT IMPLEMENTED:** configurar a lojinha permite anunciar/vender sem aguardar aprovação; habilitação comercial != verificação. Não verificado pode anunciar/vender/acumular saldo, tem status visível, não saca e segue risco/fraude. Verification SLA: 3 dias úteis, segunda–sexta; provider/KYC real segue review. Admin risk policy configurável/auditável poderá limitar venda, volume, quantidade, held, categorias e thresholds sem hardcode. Verified pode sacar se não houver blocker. EXPRESS não contorna KYC, déficit, disputa, email/security hold ou compliance.

## Withdrawal e e-mail — TARGET / NOT IMPLEMENTED

Release (`HELD→AVAILABLE`) != withdrawal (`AVAILABLE/RESERVED→externo`). STANDARD: 60 horas corridas, R$0. EXPRESS: 12 horas corridas, R$10. INSTANT não existe/ não aparece ativo. MAX não altera withdrawal. O baseline current diferente permanece em `WITHDRAWAL_POLICY.md`.

Após e-mail concluído/verificado, conta segue utilizável, mas novos saques bloqueiam por 72 horas corridas. Policy configurável; override futuro, se permitido, exige autenticação forte, autorização server-side e auditoria.

## Disputas, deficit, recovery e encerramento — TARGET / NOT IMPLEMENTED

“Reportar problema” é vitalício; vários casos históricos, máximo um ativo por Order; novo não apaga anterior; histórico imutável/auditável. Abuso vai a risco/Admin. Disputa pré-release bloqueia; Seller favorável antes da data mantém prazo e depois da data permite elegibilidade imediata sem outro blocker. Pós-release permanece reportável e pode exigir recovery/deficit.

Seller com déficit vende por padrão; risco bloqueia separadamente. Não saca com deficit/recovery. Nova venda protege primeiro seu Buyer; HELD não paga dívida velha. Depois de eligibility, proceeds amortizam FIFO por Seller pela decisão definitiva/executável. Nunca cruzar Sellers; parcial permitido; recursos recuperados ficam reservados até autorização humana (`ADMIN` baseline; granular futura).

Top-up futuro só por PSP/Pix autoritativamente confirmado, nunca edição manual, e no máximo até zerar deficit: não existe “sobra”. Encerrar acesso não apaga Ledger, Orders, cases, claims ou obrigações enquanto houver fundamento; retenção/LGPD final exige jurídico.

## Admin configurability e decisões abertas

Configuração completa exige backend authority, persistence, Admin API/UI, autorização, step-up/2FA sensível, versionamento, `effectiveFrom/effectiveTo`, publicação, actor, timestamp, audit trail, testes e snapshots não retroativos. Inclui release/mapping, tiers, MAX, VIP, SLAs, withdrawal, verification/risk, email hold, notices e LP earn/redemption/expiration; não precisam estar na mesma tela e nunca dependem de frontend hardcoded.

Permanecem abertos os providers/contratos/revisões e schemas listados em “Autoridade e limites”, além do instante técnico PENDING→AVAILABLE dos LP. Este freeze não escolhe solução para nenhum deles.
