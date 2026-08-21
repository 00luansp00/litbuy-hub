# LIT Buy — Master Implementation / Admin Matrix — 2026-08-18

**Classificação:** `PRE-HANDOFF IMPLEMENTATION PLANNING AUTHORITY` · `DERIVED FROM OWNER-AUTHORIZED TARGETS` · `NOT IMPLEMENTATION EVIDENCE`

## 1. Autoridade, finalidade e regras de leitura

Esta matriz não redefine decisões do Owner, não substitui `OWNER_COMMERCIAL_FINANCIAL_DECISION_FREEZE_2026-08-18.md`, não prova implementação, não altera o escopo Alpha e não fecha findings históricos. Ela traduz contratos autorizados em incrementos pequenos, ordenados e auditáveis. `ALPHA_SCOPE_AND_COMPLETION_CHECKLIST.md` permanece a maior autoridade de escopo Alpha; GitHub remoto permanece autoridade para branch, SHA, diff, CI, PR e merge.

A precedência é: **CURRENT IMPLEMENTATION** (código, migrations, testes e docs correntes de implementação) → **CURRENT OWNER TARGET** (contrato/Decision Freeze mais recente) → **HISTORICAL/AUDIT EVIDENCE** (válida somente no seu corte temporal). Target posterior não reescreve baseline, finding, severidade, status ou evidência histórica. Status CURRENT só pode ser provado por runtime, schema/migration, teste ou documento de implementação; ausência de prova é `UNKNOWN/NOT_PROVEN`, nunca inferência positiva.

Esta matriz serve para planejar PRs, não para afirmar production readiness. Divergência futura com Owner target mais novo exige atualizar esta matriz antes de implementar. Nenhuma PR deve escolher decisão de produto que o Owner não autorizou; use `OWNER DECISION REQUIRED`, registrando capability, opções, consequência arquitetural e se o bloqueio é imediato ou adiável.

### Vocabulário

`IMPLEMENTED`, `PARTIAL`, `NOT_IMPLEMENTED`, `DOCS_ONLY`, `DESIGN_REQUIRED`, `HUMAN_PROD_REVIEW`, `DEFERRED` e `SUPERSEDED` são os únicos estados. “Target status” significa o estado desejado após o incremento, não evidência atual. `HUMAN_PROD_REVIEW` não impede foundations locais seguras; impede alegação de prontidão para dinheiro real.

## 2. Capability matrix

**Autoridades abreviadas:** `Freeze` = Owner Decision Freeze; `Recovery` = `DISPUTE_FINANCIAL_RECOVERY_CONTRACT.md`; `Post-chat` = requisitos Owner pós-chat; `Alpha` = checklist Alpha. Evidências são caminhos verificáveis, não alegações de produção.

| ID | Capability | Owner/Domain authority | CURRENT implementation/evidence | Owner target | Gap | Dependencies | AI/Human boundary | Suggested PR | Priority | Current status | Target status |
|---|---|---|---|---|---|---|---|---|---:|---|---|
| COMMERCE-1SKU | Uma linha vendável por Order | Freeze; commerce docs | Cart e checkout exigem uma linha; fingerprint rejeita múltiplas seleções; índices únicos protegem `CartItem.cartId` e `OrderItem.orderId`; migration é fail-closed para legado incompatível | Um SKU/variant por Order; qty N do mesmo SKU; FIXED qty=1; QUOTE sem checkout; backend authority | — | — | AI_CANDIDATE | C | 0 | IMPLEMENTED | IMPLEMENTED |
| RELEASE-POLICY-HIERARCHY | SUBCATEGORY > CATEGORY > DEFAULT | Freeze | `SellerReleasePolicyVersion/Rule` possui scopes `DEFAULT`/`CATEGORY`/`SUBCATEGORY`, qualifiers por FKs estáveis, constraints/índices antiambiguidade e resolver explícito `SUBCATEGORY > CATEGORY > DEFAULT`; testes PostgreSQL cobrem precedência, fallback, IDs, invariants, lifecycle, fail-closed e read-only. O consumer legado pede somente DEFAULT e o hold continua após `COMPLETED`/PAID/CONFIRMED | IDs estáveis, versão, fallback inicial configurável de 7d, fail closed | Hierarquia concluída; checkout snapshot e novo clock permanecem separados | COMMERCE-1SKU | AI_CANDIDATE | D | 1 | IMPLEMENTED | IMPLEMENTED |
| RELEASE-CHECKOUT-SNAPSHOT | Snapshot da policy | Freeze | Novos `Order` congelam version/rule/source, classificação autoritativa e delay durante a transação do checkout; holds/eligibility/release usam esse snapshot, enquanto Orders legados NULL preservam o resolver DEFAULT histórico | Congelar source/rule/version/base delay/classificação no checkout; não retroativo | — | hierarchy | AI_CANDIDATE | E | 1 | IMPLEMENTED | IMPLEMENTED |
| RELEASE-DELIVERY-CLOCK | Relógio financeiro na entrega | Freeze | `OrderDelivery.createdAt` é DB-authoritative/imutável; novos holds usam esse timestamp e o frozen delay, com guard DB e fail-closed sem delivery. G1 removeu confirmação/completion como gates financeiros | timestamp server de entrega; nunca compra, COMPLETED ou confirmação Buyer | —; blockers/eligibility e execution permanecem G1/G2 | snapshot | AI_CANDIDATE | F | 1 | IMPLEMENTED | IMPLEMENTED |
| RELEASE-ELIGIBILITY | Cálculo e blockers | Freeze; Recovery | `SellerPendingHoldService` materializa proteção após delivery sem confirmação; eligibility valida delivery, frozen clock, payment/posting e aceita ACTIVE/AWAITING_BUYER_CONFIRMATION ou COMPLETED/CONFIRMED. NONE/RESOLVED_SELLER não bloqueiam; OPEN/UNDER_REVIEW/RESOLVED_BUYER/CLOSED bloqueiam conservadoramente; testes PostgreSQL cobrem Buyer inerte, prazo, replay e corrupção | `baseReleaseEligibleAt`, disputa prevalece, seller-win conforme contrato | Novo relógio, blockers e semântica de decisão | clock; dispute core | HYBRID_REVIEW_REQUIRED | G1 | 1 | IMPLEMENTED | IMPLEMENTED |
| RELEASE-EXECUTION | HELD → AVAILABLE | Freeze; financial docs | G2 executa atomicamente holds `RELEASE_ELIGIBLE` nos estados pós-delivery ACTIVE/AWAITING_BUYER_CONFIRMATION ou COMPLETED/CONFIRMED; revalida blockers, snapshots, payment, posting e deadline sob locks; ledger/idempotência/replay permanecem canônicos, e seleção automática pula blockers comerciais conhecidos | Executar somente elegível; separar release de payout/withdrawal | —; recovery pós-release permanece futuro | eligibility | HYBRID_REVIEW_REQUIRED | G2 | 1 | IMPLEMENTED | IMPLEMENTED |
| SELLER-MAX-LISTING | Opt-in por anúncio e snapshot | Freeze | `requestedSellerPlan` validado (`STANDARD`/`LIT_MAX`) materializa `Product.sellerPlan`; checkout single-SKU congela snapshot comercial v1 no Order na mesma transação, preserva legacy NULL e replay, com constraint/trigger PostgreSQL de shape e imutabilidade; REAL-TESTED/PASS | Opt-in listing, snapshot checkout, não assinatura | —; fee MAX, 48h, LP, estoque e mensagens permanecem capabilities separadas | 1SKU; tiers | AI_CANDIDATE | I1 | 2 | IMPLEMENTED | IMPLEMENTED |
| SELLER-MAX-FEE | Fee Seller 2,99% na venda | Freeze | Checkout resolve regra MAX canônica na mesma FeePolicyVersion do tier, materializa snapshot v2 e agrega a fee Seller-side; recognition valida o composto congelado e credita a comissão agregada, com invariants PostgreSQL e fail closed | Seller-only, sale-only, coexiste com tier | Reversal permanece capability futura | MAX listing; fee snapshot; refund contract | HYBRID_REVIEW_REQUIRED | I2 | 2 | IMPLEMENTED | IMPLEMENTED |
| SELLER-MAX-48H-QUALIFICATION | Confirmação em 48h corridas | Freeze | `buyerConfirmedAt`/fulfillment existem; janela MAX não | `buyerConfirmedAt <= deliveredAt + 48h`; expira por venda | Estado e cálculo idempotente | delivery clock; MAX snapshot | AI_CANDIDATE | J | 2 | NOT_IMPLEMENTED | IMPLEMENTED |
| SELLER-MAX-RELEASE-CALC | Redução por blocos completos | Freeze | Aceleração target não implementada | `floor(days/7)*2`; `MIN(base, MAX(target, confirmation))`; nunca atrasar | Deterministic calculator e invariants | qualification; release eligibility | AI_CANDIDATE | K | 2 | NOT_IMPLEMENTED | IMPLEMENTED |
| SELLER-MAX-STOCK-AUTOMATION | Target/consumo/pausa/restock | Freeze | Inventário e reserva existem; automação MAX não provada | target de estoque, consumir por venda, pausar zero, restock válido | State machine e concorrência | MAX listing; inventory | AI_CANDIDATE | I3 | 5 | NOT_IMPLEMENTED | IMPLEMENTED |
| SELLER-MAX-AUTOMATED-MESSAGES | Templates/eventos seguros | Freeze | UI/service mock não é authority; chat não tem system actor | Backend templates/event allowlist; sem HTML/script | Schema, versionamento e dispatcher | MAX snapshot; notices | AI_CANDIDATE | AK2 | 5 | NOT_IMPLEMENTED | IMPLEMENTED |
| LISTING-TIER | Prata/Ouro/Diamante obrigatório | Freeze | Escolha explícita no Draft; Product e checkout autoritativos; FeeRule exata Seller-side | Exatamente um: 9,99/11,99/12,99%; Seller side; distinto de reputação | — | 1SKU | AI_CANDIDATE | H1 | 2 | IMPLEMENTED | IMPLEMENTED |
| FEE-SNAPSHOT | Snapshot de rates/rules | Freeze; `FEE_SNAPSHOT.md`; CI #404 | `Order.feeSnapshotVersion` distingue legacy flat (`NULL`) de H2; `OrderFeeComponentSnapshot` relacional/versionado/imutável materializa `LISTING_TIER` na v1 e congela policy/rule/publicVersion/tier/category/party/formula/rate/base/amount/currency. Checkout cria Order + component na mesma transaction; replay não rerateia nem duplica; recognition valida H2 sem policy atual/recalculation, falha fechado para ausência/corrupção e mantém legacy compatível | Congelar versão/regra/rates; histórico não recalculável | —; MAX/VIP continuam capabilities futuras em PRs próprias | listing tier | HYBRID_REVIEW_REQUIRED | H2 | 2 | IMPLEMENTED | IMPLEMENTED |
| FEE-REFUND-REVERSAL | Reversão total/proporcional | Freeze; Refund contract | UNKNOWN/NOT_PROVEN para engine final; contrato documental em `REFUND_DELIVERY_GUARANTEE_CONTRACT.md` | Reverter somente fee própria proporcional; PSP separado | Dependência documental satisfeita após merge; engine e reconciliação de snapshots pendentes | fee snapshot; refund engine | HUMAN_PROD_REVIEW | W2 | 0 | NOT_IMPLEMENTED | HUMAN_PROD_REVIEW |
| BUYER-VIP-SELECTION | Sem Plano/Básico/Premium | Freeze | UI futura/add-on docs; backend authority não provada | escolha explícita sem preselection paga | Checkout model/validation/snapshot | 1SKU | AI_CANDIDATE | Q1 | 4 | NOT_IMPLEMENTED | IMPLEMENTED |
| BUYER-VIP-FEE | 2,99%/4,99% Buyer | Freeze | NOT_PROVEN | Base produto pós-descontos, Buyer charged | Fee policy/snapshot/ledger | VIP selection; refund contract | HYBRID_REVIEW_REQUIRED | Q2 | 4 | NOT_IMPLEMENTED | IMPLEMENTED |
| BUYER-VIP-SLA | Triagem 2d/6h/1h úteis | Freeze | NOT_PROVEN | Metadados/enforcement; calendário futuro | Business-calendar port e operations | VIP snapshot | HYBRID_REVIEW_REQUIRED | R1 | 5 | DESIGN_REQUIRED | IMPLEMENTED |
| BUYER-VIP-REFUND-SLA | 12h/6h após autorização+recursos | Freeze; Recovery | NOT_PROVEN | Cronômetro só após decisão e funding | Recovery state + operational clock | refund contract; recovery | HUMAN_PROD_REVIEW | R2 | 6 | DESIGN_REQUIRED | HUMAN_PROD_REVIEW |
| BUYER-VIP-SUPPORT | 30/60 dias | Freeze | NOT_PROVEN | Metadado/enforcement, não limita reporting | Support operations/terms | VIP snapshot | HYBRID_REVIEW_REQUIRED | R3 | 6 | NOT_IMPLEMENTED | IMPLEMENTED |
| LITPOINTS-LEDGER | Ledger append-only | Freeze | UI/mock config existe; nenhum ledger LP autoritativo | Histórico persistente; nunca `user.points` | Schema/event/invariants | fee/refund contracts | HYBRID_REVIEW_REQUIRED | S | 4 | NOT_IMPLEMENTED | IMPLEMENTED |
| LITPOINTS-BUYER-EARN | Earn monetário | Freeze | NOT_PROVEN | floor R$1=1; Basic +30%; Premium +80%; só dinheiro real | LP ledger; payment classification | VIP snapshot; LP availability | HYBRID_REVIEW_REQUIRED | T1 | 5 | NOT_IMPLEMENTED | IMPLEMENTED |
| LITPOINTS-SELLER-EARN | Earn Seller MAX | Freeze | NOT_PROVEN | sem MAX 0; `floor(value/2)` depois +50%; R$100=75 | LP ledger; MAX snapshot | MAX; LP availability | HYBRID_REVIEW_REQUIRED | T2 | 5 | NOT_IMPLEMENTED | IMPLEMENTED |
| LITPOINTS-AVAILABILITY | PENDING → AVAILABLE | Freeze | NOT_PROVEN | Instante técnico permanece aberto | Owner/domain design; não inventar evento | payments; fulfillment/refund | HUMAN_PROD_REVIEW | OWNER DECISION REQUIRED | 4 | DESIGN_REQUIRED | DESIGN_REQUIRED |
| LITPOINTS-EXPIRATION | Lotes/3 meses/FEFO | Freeze | NOT_PROVEN | 3 meses calendário de AVAILABLE; FEFO | Availability; scheduler idempotente | LP availability; jobs | AI_CANDIDATE | U | 6 | NOT_IMPLEMENTED | IMPLEMENTED |
| LITPOINTS-REDEMPTION | 100 LP=R$1, integral | Freeze | UI/mock não é authority | 100% LP ou indisponível; sem mixed tender | Reservation/debit/checkout/ledger | LP ledger; funding | HYBRID_REVIEW_REQUIRED | V | 6 | NOT_IMPLEMENTED | IMPLEMENTED |
| LITPOINTS-FUNDING | Plataforma financia resgate | Freeze | Nenhum accounting bucket final provado | Seller continua BRL; ledger/accounting separado | Buckets finais abertos e validação contábil | redemption; finance architecture | HUMAN_PROD_REVIEW | V2 | 6 | DESIGN_REQUIRED | HUMAN_PROD_REVIEW |
| LITPOINTS-REFUND | Reversão/devolução LP | Freeze; Refund contract | NOT_PROVEN; contrato documental em `REFUND_DELIVERY_GUARANTEE_CONTRACT.md` | Buyer: reversão proporcional; tender LP volta com novos 3 meses; sem novo earn. Seller LP/gasto prévio seguem abertos | Dependência documental satisfeita após merge; decisões abertas e engine pendentes | LP ledger; refund engine | HUMAN_PROD_REVIEW | W | 7 | NOT_IMPLEMENTED | HUMAN_PROD_REVIEW |
| SELLER-COMMERCIAL-ENABLEMENT | Loja habilita venda | Freeze | Application + Admin approval cria profile/role; approval ainda é gate | Configurar lojinha permite vender sem approval comercial | Novo provisioning e migração segura de gate | RBAC; listing | AI_CANDIDATE | N | 3 | PARTIAL | IMPLEMENTED |
| SELLER-VERIFICATION | Verificação separada | Freeze | `SellerProfile.verified` boolean existe, explicitamente não KYC | Estado separado; SLA 3 dias úteis; provider humano | Lifecycle/audit/provider port | commercial enablement | EXTERNAL_PROVIDER_DECISION | O1 | 5 | PARTIAL | HUMAN_PROD_REVIEW |
| SELLER-UNVERIFIED-VISIBILITY | Badge público | Freeze | `verified` chega a DTOs/catalog; cobertura visual/semântica target não provada | status visível ao Buyer | Consistência API/UI e truthful copy | verification | AI_CANDIDATE | O2 | 5 | PARTIAL | IMPLEMENTED |
| SELLER-WITHDRAWAL-VERIFICATION-GATE | Não verificado não saca | Freeze | Risk policy foundation existe, enforcement end-to-end não provado | verified obrigatório | Withdrawal authority + security | verification; withdrawal | HYBRID_REVIEW_REQUIRED | O3 | 5 | PARTIAL | IMPLEMENTED |
| SELLER-UNVERIFIED-RISK-POLICY | Limites administráveis | Freeze | Não provado; thresholds não decididos | valor/venda, volume, qty, held, categorias; thresholds abertos | Config schema; risk engine | verification; admin controls | HYBRID_REVIEW_REQUIRED | P | 7 | DESIGN_REQUIRED | DESIGN_REQUIRED |
| WITHDRAWAL-STANDARD | 60h, R$0 | Freeze | Somente STANDARD está enabled: até 48h, aprovação MANUAL ADMIN e fee adicional R$0 | 60h corridas, R$0; MAX não altera withdrawal | Versionar novo SLA preservando approval, blockers e histórico | ledger; blockers | HYBRID_REVIEW_REQUIRED | AG1 | 6 | PARTIAL | IMPLEMENTED |
| WITHDRAWAL-EXPRESS | 12h, R$10 | Freeze | EXPRESS não está habilitado/implementado; somente STANDARD está enabled | 12h corridas, R$10, não instantâneo; MAX não altera withdrawal | Policy/snapshot/posting sem bypass de blockers | standard; blockers | HYBRID_REVIEW_REQUIRED | AG2 | 6 | NOT_IMPLEMENTED | IMPLEMENTED |
| WITHDRAWAL-INSTANT | Nenhuma opção INSTANT ativa | Freeze | `INSTANT` está representado para future compatibility, porém disabled; somente STANDARD está enabled e INSTANT não deve aparecer no frontend | STANDARD + EXPRESS são os únicos speeds target; nenhuma opção INSTANT ativa; MAX não altera withdrawal | Remover/deprecar a expectativa futura de INSTANT onde necessário, preservando compatibilidade/histórico; eventual enum/schema será decidido no slice de implementação, sem remoção destrutiva nesta PR | withdrawal compatibility | AI_CANDIDATE | AG3 | 5 | PARTIAL | IMPLEMENTED |
| WITHDRAWAL-BLOCKERS | Gates de saque | Freeze; Recovery | Risk-policy foundation apenas parcial | verified, deficit/recovery, dispute, security, compliance, email; EXPRESS não bypassa | Orquestrador fail-closed | dispute; deficit; verification | HUMAN_PROD_REVIEW | AH | 5 | PARTIAL | HUMAN_PROD_REVIEW |
| EMAIL-CHANGE-WITHDRAWAL-HOLD | Hold 72h | Freeze | Mudança de email/audit auth existem; vínculo com saque não | 72h configurável; override futuro forte/auditável se autorizado | Security event + withdrawal gate | email flow; withdrawal | HYBRID_REVIEW_REQUIRED | AI | 6 | NOT_IMPLEMENTED | IMPLEMENTED |
| DISPUTE-PERSISTENT-CORE | Casos e histórico | Freeze; Recovery | Nenhum model `Dispute` no schema | vários históricos, máximo um ativo/Order, histórico imutável | Schema, state machine, uniqueness/audit | Order; auth | HYBRID_REVIEW_REQUIRED | X | 3 | NOT_IMPLEMENTED | IMPLEMENTED |
| BUYER-REPORT-PROBLEM | Backend real vitalício | Freeze; Post-chat | UI/support mock; backend dispute ausente | label, ownership/IDOR, lifetime reporting, eligibility | Dispute API/security/UI | dispute core | HYBRID_REVIEW_REQUIRED | Y | 3 | NOT_IMPLEMENTED | IMPLEMENTED |
| DISPUTE-PRE-RELEASE-BLOCK | Disputa bloqueia release | Freeze; Recovery | Release não consulta dispute inexistente | blocker prevalece | Integrar atomically ao eligibility | dispute core; release | HYBRID_REVIEW_REQUIRED | Z | 3 | NOT_IMPLEMENTED | IMPLEMENTED |
| DISPUTE-POST-RELEASE-RECOVERY | Recovery após release | Recovery; Refund contract | NOT_PROVEN; boundaries documentais reconciliadas | pode gerar recovery/deficit decomposto; sem instant refund promise | Dependência documental satisfeita após merge; final decision + resources + engine pendentes | recovery core | HUMAN_PROD_REVIEW | AA | 7 | NOT_IMPLEMENTED | HUMAN_PROD_REVIEW |
| DISPUTE-SLA | 48h úteis/2 dias úteis | Freeze | NOT_PROVEN | calendário operacional futuro | Business-calendar design/ops | dispute core | HYBRID_REVIEW_REQUIRED | X2 | 7 | DESIGN_REQUIRED | IMPLEMENTED |
| SELLER-DEFICIT | Conta e regras | Recovery | `SELLER_DEFICIT` ledger account/read existe; mutation/recovery target não | deficit por Seller, auditável, blocker de saque | Recovery postings/invariants | refund contract | HYBRID_REVIEW_REQUIRED | AA1 | 4 | PARTIAL | IMPLEMENTED |
| RECOVERY-QUEUE | FIFO por Seller | Recovery | NOT_PROVEN | executable-time FIFO, partial, nunca cross-Seller | Queue schema/locking/idempotency | deficit; final decision | HYBRID_REVIEW_REQUIRED | AB | 7 | NOT_IMPLEMENTED | IMPLEMENTED |
| NEW-SALE-DEFICIT-AMORTIZATION | Proteção da nova venda | Recovery | NOT_PROVEN | HELD não paga dívida; após eligibility amortiza | Posting order/invariants | queue; release | HUMAN_PROD_REVIEW | AB2 | 7 | NOT_IMPLEMENTED | HUMAN_PROD_REVIEW |
| RECOVERY-RESERVATION | Recursos reservados | Recovery | `SELLER_RESERVED` bucket foundation existe; recovery allocation não | Reservar até autorização | Ledger postings/read model | queue | HYBRID_REVIEW_REQUIRED | AC | 7 | PARTIAL | IMPLEMENTED |
| BUYER-PAYOUT-AUTHORIZATION | ADMIN baseline | Recovery | Admin financial permission/mutation não provada | autorização humana; granular futura | Step-up/RBAC/audit/outbox | reservation | HUMAN_PROD_REVIEW | AD | 8 | DESIGN_REQUIRED | HUMAN_PROD_REVIEW |
| BUYER-FINANCIAL-BALANCE | Ledger próprio futuro | Recovery | Não existe; não usar SELLER_AVAILABLE | Ledger Buyer separado | Buckets/permissões finais abertos | authorization; recovery | HUMAN_PROD_REVIEW | AE | 9 | DESIGN_REQUIRED | HUMAN_PROD_REVIEW |
| SELLER-TOP-UP | PSP/Pix até deficit | Recovery | Não existe | confirmação PSP autoritativa; sem surplus/manual balance | PSP decision/webhook/ledger | deficit | EXTERNAL_PROVIDER_DECISION | AF | 9 | HUMAN_PROD_REVIEW | HUMAN_PROD_REVIEW |
| ACCOUNT-CLOSURE-FINANCIAL-RETENTION | Preservar obrigações | Recovery | Auth/account flows existem; regra financeira/LGPD final não provada | não apagar ledger/orders/cases/claims | Retention policy e legal basis | all finance/dispute | LEGAL_REVIEW | AF2 | 9 | DESIGN_REQUIRED | HUMAN_PROD_REVIEW |
| REFUND-DELIVERY-GUARANTEE-CONTRACT | Contrato anterior ao engine | Freeze; Recovery; `REFUND_DELIVERY_GUARANTEE_CONTRACT.md` | Phase 0-B documental satisfeita após merge; contrato concreto presente; engine continua `NOT IMPLEMENTED` | Semântica total/partial, fees próprias, PSP/provider boundaries, VIP/LP gaps, deficit, recovery e chargeback documentados | Implementar somente após gates e decisões abertas do contrato | — | HYBRID_REVIEW_REQUIRED | B | 0 | DOCS_ONLY | DOCS_ONLY |
| ORDER-CHAT-SYSTEM-NOTICES | Notices financeiros | Freeze | Chat Buyer/Seller persistente/idempotente existe; sender obrigatório é User; notices system não | PAID/delivery/base/MAX/qualification/expiration; system actor; immutable/idempotent | Event contracts, templates, schema | release/MAX; chat core | AI_CANDIDATE | AK | 8 | NOT_IMPLEMENTED | IMPLEMENTED |
| CHAT-VISUAL-UX | QA-BROWSER-014 | Browser QA | Core chat real testado; finding visual permanece | Corrigir somente delta visual autorizado | Finding scope | ORDER-CHAT-SYSTEM-NOTICES; SELLER-MAX-AUTOMATED-MESSAGES | AI_CANDIDATE | AK3 | 9 | PARTIAL | IMPLEMENTED |
| ACCOUNT-WIDE-NOTIFICATIONS | Independente de activeRole | Post-chat; QA-BROWSER-016 | notification service/UI predominantemente mock/role-coupled; backend authority não provada | Conta inteira, eventos permitidos | Notification backend/preferences | auth/RBAC; events | HYBRID_REVIEW_REQUIRED | AL | 8 | NOT_IMPLEMENTED | IMPLEMENTED |
| CATALOG-TRUST-SIGNALS | Sinais de confiança | Post-chat | Catálogo real expõe alguns dados; target completo não provado | PRE-HANDOFF CANDIDATE conforme Owner requirements | Contrato de fields/copy | verification/catalog | AI_CANDIDATE | FOLLOWUP-1 | 9 | PARTIAL | IMPLEMENTED |
| PRODUCT-QA | Perguntas de produto | Post-chat | UI/service legado não prova backend persistente | PRE-HANDOFF CANDIDATE | Contract/moderação/auth | catalog | HYBRID_REVIEW_REQUIRED | FOLLOWUP-2 | 9 | NOT_IMPLEMENTED | IMPLEMENTED |
| SELLER-RATING-REPUTATION | Reputação não financeira | Freeze; Post-chat | UI/types existem; backend target não provado | DEFERRED/FUTURE; jamais condição de release | Contrato próprio; desacoplar finance | order completion | HYBRID_REVIEW_REQUIRED | FUTURE-1 | 10 | DEFERRED | DEFERRED |

### Contagem controlada

Há **58 capabilities** nesta versão: `IMPLEMENTED 10`, `PARTIAL 11`, `NOT_IMPLEMENTED 25`, `DOCS_ONLY 1`, `DESIGN_REQUIRED 9`, `HUMAN_PROD_REVIEW 1`, `DEFERRED 1`, `SUPERSEDED 0`. A contagem usa **Current status**; target humano não altera a evidência CURRENT.

## 3. Implementation layers matrix

Esta matriz complementa cada linha acima e cobre todas as camadas obrigatórias. “—” significa que a camada não é necessária naquele slice, não que esteja implementada.

| Capability group | DB/Schema | Backend domain | API | Admin backend/UI | Buyer/Seller frontend | Authorization/Security | Audit/History | Jobs/Async | Ledger/Financial impact | Tests required | Browser/DB validation |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Commerce / order shape | Constraint/model compatível com qty | Cart/checkout invariant | erros estáveis | — | cart/checkout sem multi-line | owner + CSRF/IDOR | checkout snapshot | expiration/reservation existentes | valor da única linha | unit + integration concorrente | DB prova uma line; browser A+B negado |
| Release core | Policy versions/rules/snapshot/timestamps | resolver, clock, eligibility, release | reads operacionais; Admin separado | CRUD/publicação depois | datas/status truthful | Admin RBAC; fail closed | actor/version/effective dates | eligibility/release idempotentes | HELD→AVAILABLE double entry | resolver, boundary time, blocker, replay | snapshots antigos imutáveis; delta browser |
| Tiers / MAX | listing opt-in, fee/release snapshots | calculators determinísticos | listing/checkout reads | configuração versionada | seleção Seller e disclosures | listing ownership; Admin step-up | rule/version/actor | stock/messages/release jobs | seller fees/LP/release | formulas/examples/replay/refund | Order snapshot + ledger postings |
| Buyer VIP | checkout snapshot | fee/SLA metadata | checkout + support reads | config versionada | escolha explícita sem dark pattern | Buyer ownership; Admin RBAC | consent/snapshot | SLA timers futuros | Buyer fee/LP | no paid default, rates, clocks | DB snapshot; checkout delta |
| LIT Points | ledger, lots, reservations | earn/expire/redeem/refund | balances/history/checkout | policies versionadas | truthful balance/expiry | ownership, replay, anti-overdraw | append-only causation | expiration/retry | accounting separado; no mutable points | property/invariant/concurrency | ledger sums/FEFO; browser delta |
| Seller verification | lifecycle/risk versions | enablement, verification, gates | seller/admin/public | queue/config UI | badge/status/withdrawal reason | KYC sensitive; step-up | decisions/evidence metadata | SLA/provider callbacks futuros | withdrawal only | role separation/IDOR/gates | DB role/profile; truthful UI |
| Withdrawal/security | policy/snapshot/request/hold | STANDARD/EXPRESS + blockers | owner request/admin ops | sensitive configuration | ETA/fee/blocker | verified + step-up + email hold | immutable transitions/override | orchestration/outbox | AVAILABLE/RESERVED/external | no bypass, replay, time boundaries | DB postings; no INSTANT UI |
| Dispute | cases/events/one-active constraint | eligibility/lifetime/state | Buyer report/Admin decision | case operations | “Reportar problema” | ownership/IDOR/high-risk permission | immutable full history | SLA/escalation future | pre-block/post-recovery | uniqueness, auth, state, replay | multiple history/one active; UI label |
| Recovery | deficit/queue/allocation/reservation | FIFO/partial/amortization | Admin reads/actions | authorization + audit UI | status without false refund promise | step-up/segregation of duties | causation/decision time | locking/retry/outbox | double entry, no cross-Seller | concurrency/property/idempotency | reconcile queue/ledger/resources |
| Refund contract/engine | Contract first; later records | total/partial components | only after contract | authorization | method/status copy | high-risk | immutable decisions | PSP callbacks future | fee/LP/deficit/recovery | component matrix/replay | reconciliation + controlled browser |
| Chat/notices/notifications | system actor/message/event/preferences | allowlisted event renderer | chat/account feed | template governance | account-wide and chat display | participants; no forged sender/HTML | immutable/version/template | outbox/idempotent delivery | display only; sourced from finance | delta notices + minimal chat regression | persisted once; cross-role visibility |
| Follow-ups | domain-specific | no financial coupling | owner-scoped | moderation if authorized | trust/QA/reputation | abuse controls | moderation history | notifications optional | rating has **zero** release effect | contract-specific | only new delta |

## 4. Admin configurability matrix

`Admin configurable` só existe quando há backend authority + persistência + API + UI + autorização + auditoria + versionamento quando aplicável + testes. Inputs frontend atuais não satisfazem essa definição. Todas as mutações sensíveis exigem server authorization; `Step-up` abaixo é baseline de segurança a validar, não nome final de permissão.

| Config ID | Configuração | Valor inicial Owner | Runtime authority / persistência | Versioning / effective dates | Admin API / UI | Permission / Step-up-2FA | Audit actor/time | Snapshot? / Retroactive? | Current status | Suggested PR |
|---|---|---|---|---|---|---|---|---|---|---|
| CFG-REL-DEFAULT | Release default | 7 dias | resolver backend / policy tables | sim / from-to | required / required | financial-policy / sim | required | sim / não | PARTIAL | L→M |
| CFG-REL-CAT | Release por categoria | Freeze mappings (4d/7d) | resolver / stable category ID | sim / from-to | required / required | financial-policy / sim | required | sim / não | PARTIAL | L→M |
| CFG-REL-SUBCAT | Release por subcategoria | override autorizado; nenhum valor novo | resolver / stable subcategory ID | sim / from-to | required / required | financial-policy / sim | required | sim / não | NOT_IMPLEMENTED | L→M |
| CFG-REL-CLASS | Classification mapping | mappings do Freeze | resolver / relation IDs | sim / from-to | required / required | financial-policy / sim | required | sim / não | PARTIAL | L→M |
| CFG-TIERS | Prata/Ouro/Diamante | 9,99% / 11,99% / 12,99% | fee engine / versions | sim / from-to | required / required | financial-policy / sim | required | sim / não | PARTIAL | L→M |
| CFG-MAX-FEE | Fee MAX | 2,99% Seller | fee engine / versions | sim / from-to | required / required | financial-policy / sim | required | sim / não | PARTIAL | L→M |
| CFG-MAX-BENEFITS | Toggles MAX | estoque, mensagens, release benefit | MAX policy / versions | sim / from-to | required / required | commercial-policy / sim | required | sim / não | NOT_IMPLEMENTED | L→M |
| CFG-MAX-WINDOW | Janela de qualificação | 48h corridas | release calculator / versions | sim / from-to | required / required | financial-policy / sim | required | sim / não | NOT_IMPLEMENTED | L→M |
| CFG-MAX-REDUCTION | Redução | 2 dias/bloco completo de 7 | release calculator / versions | sim / from-to | required / required | financial-policy / sim | required | sim / não | NOT_IMPLEMENTED | L→M |
| CFG-VIP-BASIC | VIP Basic rate | 2,99% | fee engine / versions | sim / from-to | required / required | financial-policy / sim | required | sim / não | NOT_IMPLEMENTED | Q→M2 |
| CFG-VIP-PREMIUM | VIP Premium rate | 4,99% | fee engine / versions | sim / from-to | required / required | financial-policy / sim | required | sim / não | NOT_IMPLEMENTED | Q→M2 |
| CFG-VIP-LP | VIP LP multipliers | +30% / +80% | points engine / versions | sim / from-to | required / required | points-policy / sim | required | sim / não | NOT_IMPLEMENTED | T→M2 |
| CFG-MEDIATION-SLA | Standard mediation | 48h úteis / 2 dias úteis | dispute ops / policy | sim / from-to | required / required | operations-policy / sim | required | no Order snapshot; case SLA / não | DESIGN_REQUIRED | X2→M3 |
| CFG-VIP-TRIAGE | VIP triage | Basic 6h úteis; Premium 1h útil; padrão 2d úteis | support ops / policy | sim / from-to | required / required | operations-policy / sim | required | sim / não | DESIGN_REQUIRED | R→M3 |
| CFG-VIP-REFUND-SLA | Refund processing | Basic 12h; Premium 6h corridas | recovery ops / policy | sim / from-to | required / required | financial-ops / sim | required | sim / não | DESIGN_REQUIRED | R→M3 |
| CFG-VIP-SUPPORT | Support duration | 30d / 60d | support domain / policy | sim / from-to | required / required | operations-policy / sim | required | sim / não | NOT_IMPLEMENTED | R→M3 |
| CFG-LP-BUYER | Buyer earn | 1x / 1,30x / 1,80x; floor | points engine / versions | sim / from-to | required / required | points-policy / sim | required | sim / não | NOT_IMPLEMENTED | T→M4 |
| CFG-LP-SELLER | Seller earn | 0; MAX floor(value/2)×1,50 | points engine / versions | sim / from-to | required / required | points-policy / sim | required | sim / não | NOT_IMPLEMENTED | T→M4 |
| CFG-LP-REDEEM | Redemption | 100 LP = R$1; full tender | points/checkout / versions | sim / from-to | required / required | financial-policy / sim | required | sim / não | NOT_IMPLEMENTED | V→M4 |
| CFG-LP-EXPIRY | Expiration | 3 meses calendário de AVAILABLE | points lots / versions | sim / from-to | required / required | points-policy / sim | required | por lote / não | NOT_IMPLEMENTED | U→M4 |
| CFG-WD-STANDARD | STANDARD | 60h corridas; R$0 | withdrawal / policy versions | sim / from-to | required / required | financial-policy / sim | required | request snapshot / não | PARTIAL | AG→M5 |
| CFG-WD-EXPRESS | EXPRESS | 12h corridas; R$10 | withdrawal / policy versions | sim / from-to | required / required | financial-policy / sim | required | request snapshot / não | NOT_IMPLEMENTED | AG→M5 |
| CFG-VERIFY-SLA | Verification SLA | 3 dias úteis seg-sex | verification / policy | sim / from-to | required / required | verification-ops / sim | required | case SLA / não | DESIGN_REQUIRED | O→M6 |
| CFG-UNVERIFIED-RISK | Unverified limits | dimensions authorized; thresholds **OWNER DECISION REQUIRED** | risk engine / versions | sim / from-to | required / required | risk-policy / sim | required | decision snapshot / não | DESIGN_REQUIRED | P→M6 |
| CFG-EMAIL-HOLD | Email-change hold | 72h corridas | auth security + withdrawal / policy | sim / from-to | required / required | security-policy / sim | required | event policy / não | NOT_IMPLEMENTED | AI→M5 |
| CFG-SYSTEM-NOTICES | Notice templates | eventos/variáveis do Freeze; conteúdo final versionado | backend renderer / templates | sim / from-to | required / required | communications-policy / conforme risco | required | template version / não | NOT_IMPLEMENTED | AK→M7 |

**Total:** 26 rows. Valores sem baseline numérico autorizado permanecem sem número; nenhum threshold de risco foi inventado. API e UI podem ser PRs distintas, mas a capability não ganha status “Admin configurable” até o conjunto estar completo e testado.

## 5. Dependency graph e ordem executável

1. **Phase 0 — governance:** A (esta matriz), depois B (Refund/Delivery Guarantee contract). B bloqueia reversão final, recovery/refund financeiro e LP refund, mas não bloqueia foundations não mutantes.
2. **Phase 1 — commerce shape:** C, pois snapshots futuros precisam de uma única line/SKU inequívoca.
3. **Phase 2 — release core:** D → E → F → G1 → G2. Diferença justificada do baseline: eligibility e execution são PRs separadas para preservar a autoridade do ledger e permitir validar o relógio antes da mutação.
4. **Phase 3 — commercial snapshots:** H1 → H2; I1 → I2 → I3. Tiers e MAX precisam existir no listing antes de congelar e cobrar.
5. **Phase 4 — MAX release:** J → K, integrando depois ao release core.
6. **Phase 5 — Admin:** L (release/tier/MAX API/versioning) → M (UI/permissions/audit). Configurações VIP/LP/withdrawal seguem APIs M2–M7 somente depois de cada domínio.
7. **Phase 6 — Seller:** N → O1/O2/O3 → P. Thresholds de P podem ser adiados; engine/schema não devem inventá-los.
8. **Phase 7 — Buyer commercial:** Q1 → Q2 → R1/R2/R3.
9. **Phase 8 — LP:** S → `OWNER DECISION REQUIRED` para availability → T1/T2 → U → V → W. Availability bloqueia earn disponível/expiry/refund final.
10. **Phase 9 — disputes:** X → X2/Y → Z.
11. **Phase 10 — recovery:** AA1/AA → AB → AB2 → AC → AD → AE → AF. Engine final depende de B; AE/AF permanecem human/provider gates.
12. **Phase 11 — withdrawal:** AG1/AG2/AG3 → AH → AI; cash-out PSP real permanece gate humano.
13. **Phase 12 — communications:** AK/AK2 → AK3; AL independente do `activeRole`.
14. **Phase 13 — validation:** browser/DB somente para capabilities novas → Final Delta Audit/Pre-Handoff. Follow-ups de catálogo/QA são candidatos separados; reputation permanece future.

As maiores dependências arquiteturais são LP availability/funding/refund, refund/recovery/deficit, release clock + dispute blocker, withdrawal orchestration e Buyer financial balance. Elas cruzam snapshots, ledger, idempotência, autorização e decisões externas; não devem virar “finance rewrite”.

## 6. PR slicing rules

- Uma capability auditável por PR; exceção apenas se separar quebrar atomicidade, explicitando a razão.
- Migrations pequenas; schema foundation pode anteceder behavior.
- Nenhum rewrite financeiro monolítico. Admin API e Admin UI podem ser PRs separadas.
- Frontend nunca antecede backend authority para regra financeira.
- Docs contract antecede engine financeiramente sensível.
- Toda PR financeira inclui idempotência, invariants, concorrência e reconciliação aplicáveis.
- Toda mutação financeira considera Ledger como authority; read model/UI não alteram saldo.
- Snapshot histórico nunca é recalculado por policy nova; rollout inclui effective dates e fail-closed.

## 7. Anti-repeat / validation matrix

Antes de testar: **ITEM → JÁ TESTADO? → ONDE ESTÁ A EVIDÊNCIA? → CÓDIGO RELEVANTE MUDOU? → HÁ OBJETIVO DE REGRESSÃO? → PRECISA REPETIR?** Sem mudança relevante e sem objetivo de regressão, não repetir agora.

| Item | Estado/evidência | Regra futura |
|---|---|---|
| cart/checkout clean flows | `REAL-TESTED/PASS`; `FINAL_FUNCTIONAL_VALIDATION_CHECKLIST.md` | delta 1SKU + regressão mínima |
| payment idempotency/replay | `REAL-TESTED/PASS`; checklist final e specs financial | repetir somente se orchestration/postings mudarem |
| inventory/sale recognition | `REAL-TESTED/PASS`; checklist final | delta de stock/MAX, não full suite manual |
| seller fulfillment | `REAL-TESTED/PASS`; checklist final | delta deliveredAt/release clock |
| Buyer confirmation | `REAL-TESTED/PASS`; checklist final | delta 48h/MAX boundaries |
| seller onboarding foundation | `REAL-TESTED/PASS`; checklist final/foundation | delta enablement/verification separation |
| ListingDraft | `REAL-TESTED/PASS`; checklist final | delta tier/MAX only |
| Seller finance | `REAL-TESTED/PASS`; checklist final | delta ledger buckets/postings |
| auth refresh | `REAL-TESTED/PASS`; checklist final | somente se auth/security touched |
| Admin categories | `REAL-TESTED/PASS`; checklist final | delta release mapping |
| Order Chat Buyer/Seller | `REAL-TESTED/PASS`; Order Chat contract/checklist | **não** repetir core por causa de notices |
| post-COMPLETED chat persistence | `REAL-TESTED/PASS`; post-chat validation | notices: delta + regressão mínima relevante |

## 8. CURRENT/TARGET reconciliation register

As divergências não foram resolvidas silenciosamente:

1. Release policy CURRENT resolve `SUBCATEGORY > CATEGORY > DEFAULT` por IDs estáveis e configuração publicada, congela o resultado no checkout e inicia o relógio de novos holds em `OrderDelivery.createdAt`. O path legado sem snapshot continua DEFAULT, mas também usa a delivery persistida. O lifecycle CURRENT materializa hold após delivery sem confirmação e eligibility usa o clock original com blockers conservadores; execução monetária target permanece G2. Rating não tem efeito financeiro e somente Seller MAX poderá antecipar em capability futura. Evidência histórica permanece intacta.
2. Seller onboarding CURRENT depende de application/Admin approval; target separa commercial enablement de verification. Requer N–O.
3. Withdrawal CURRENT habilita somente STANDARD até 48h, MANUAL ADMIN e R$0. `INSTANT` existe apenas como representação future-compatible disabled e não deve aparecer no frontend. O Owner target substitui o baseline comercial futuro por STANDARD 60h/R$0 + EXPRESS 12h/R$10, sem opção INSTANT ativa e sem benefício MAX. Eventual depreciação deve preservar compatibilidade e histórico.
4. ListingDraft CURRENT usa `SILVER/GOLD/DIAMOND` e Seller plan; target público é PRATA/OURO/DIAMANTE e MAX por listing com fee/benefits. Requer reconciliação de identifiers/copy/snapshots.
5. `SELLER_DEFICIT` e `SELLER_RESERVED` existem como accounts/read foundation, mas não provam recovery target.
6. Chat CURRENT exige User sender e prova chat humano; target system notices exige ator/semântica próprios, sem sender falso.
7. Frontend mostra LP/Admin/notifications/verification em partes mockadas; não constitui backend authority.
8. Rating/reputation legado não pode ser reintroduzido como condição financeira de release.

## 9. AI/Human boundary e production gates

**Pre-handoff implementable/local/FAKE_ALPHA:** schemas internos; calculators determinísticos; services/APIs; snapshots; Admin CRUD/versioning; UI; state machines; ports/adapters fake; tests de invariant/idempotência/concurrency; browser/DB delta. Isso é `AI_CANDIDATE` ou foundation de `HYBRID_REVIEW_REQUIRED`, não dinheiro real.

**Hybrid review:** recovery/deficit, Buyer finance, withdrawal orchestration, top-up foundation, high-risk permission boundaries e qualquer mudança de ledger. Exigem revisão humana de arquitetura, segurança e reconciliação antes de promover.

**Productionization/human gates:** PSP/split/escrow/payout real, chargeback, KYC/biometria, antifraude, segurança final, production Ledger validation e reconciliação são `HUMAN_PROD_REVIEW`; escolha de provider é `EXTERNAL_PROVIDER_DECISION`; LGPD, retenção, termos e promessas comerciais/financeiras são `LEGAL_REVIEW`.

Permanecem deliberadamente abertas: PSP final/Mercado Pago homologation, split/escrow semantics, PSP fee, chargeback responsibility, payout real, KYC provider, biometria, antifraude, hosting, DB/Redis, storage/CDN/WAF, RPO/RTO, observability, broker/queue, analytics, legal/LGPD, nomes finais de buckets Buyer, nomes finais de permissões financeiras granulares, instante técnico LP PENDING→AVAILABLE e schemas marcados DESIGN_REQUIRED.

### OWNER DECISION REQUIRED

- **LITPOINTS-AVAILABILITY:** escolher o evento técnico PENDING→AVAILABLE. Opções devem ser propostas em PR documental futura (por exemplo, eventos financeiros existentes avaliados contra refund/chargeback), sem seleção nesta matriz. Impacta earn, expiração, redemption e refund; bloqueia esses behaviors finais, mas não o ledger foundation S.
- **SELLER-UNVERIFIED-RISK-POLICY:** thresholds por dimensão não foram autorizados. Impacta enforcement/commercial limits; schema/config engine pode ser preparado sem defaults ativos, mas rollout de limites bloqueia até decisão.
- Permissões financeiras granulares e Buyer ledger bucket names continuam design humano; bloqueiam production mutation, não contratos/ports/foundations.

## 10. Manutenção e critério de atualização

Cada PR futura deve atualizar somente as linhas tocadas, ligar evidência CURRENT concreta (migration/service/spec/validation), preservar target Owner e registrar mudança relevante que justifique regressão. `IMPLEMENTED` requer todas as camadas contratadas; UI isolada, enum, type, mock ou account vazio não basta. Esta matriz deve ser reconciliada antes da implementação se surgir novo Decision Freeze.
