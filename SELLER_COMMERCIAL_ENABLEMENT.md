# Seller commercial enablement

## CURRENT após a capability N

`POST /seller-onboarding/application/submit` finaliza a configuração da loja e habilita o
Seller comercialmente, sem depender de `start-review` ou `approve` administrativos. Dentro de
uma única transaction `SERIALIZABLE`, com retry para conflitos de serialização, o backend:

1. revalida conta `ACTIVE`, role `BUYER`, e-mail e telefone verificados e idade mínima;
2. exige a versão vigente do Seller Agreement e valida nome, descrição, slug e sua unicidade;
3. cria exatamente um `SellerProfile` `ACTIVE`, com `verified=false`;
4. concede a role `SELLER` pela primitive idempotente de RBAC; e
5. move uma application `DRAFT` para `SUBMITTED` e grava os audits correspondentes.

`commercialEnabled`, devolvido por `GET /seller-onboarding/me`, não é persistido: ele é derivado
da existência simultânea de `SellerProfile.status=ACTIVE` e da role `SELLER` na persistence.

## Separação de autoridades

- `SellerApplication` continua registrando o workflow e o histórico de review. Uma application
  pode permanecer `SUBMITTED` ou `UNDER_REVIEW` enquanto a loja opera.
- `SellerProfile.verified` continua sendo a autoridade separada de verificação. Self-enablement
  nunca marca KYC/verificação como concluída.
- `start-review` e `reject` não revogam role, não removem nem suspendem profile e não bloqueiam
  anúncios, saldo ou comércio.
- A moderação de listing continua separada: o Seller pode criar/submeter drafts, mas publicação
  ainda depende do lifecycle e da aprovação de catálogo existentes.
- Checkout, reconhecimento financeiro, holds, saldo e suas regras não foram alterados.

## Idempotência, legado e controles

- Replays coerentes não criam outro profile, role ou audit de criação. O slug já materializado não
  pode ser trocado silenciosamente.
- Applications legadas `SUBMITTED` e `UNDER_REVIEW` adotam o enablement sob demanda, preservando
  o status. Não existe backfill em lote.
- `APPROVED` legado só é coerente quando mantém profile `ACTIVE`, a mesma identidade de loja
  (`userId`, slug validado, nome e descrição) e role `SELLER`; qualquer divergência falha fechada,
  sem reconstrução silenciosa, tanto no replay de submit quanto no replay de Admin approve.
- `REJECTED` precisa voltar a `DRAFT` por correção e passar por nova submissão válida.
- Profile `SUSPENDED` ou `CLOSED` nunca é reativado pelo onboarding.
- Submits concorrentes do mesmo user são serializados por advisory transaction lock determinístico;
  ambos convergem para a mesma application `SUBMITTED`, um profile, uma role e um audit de criação,
  sem bloquear o enablement de users diferentes.
- Slug de terceiro falha com `SELLER_SLUG_UNAVAILABLE`; a transaction não deixa application,
  profile e role parcialmente persistidos.
- `approve` administrativo aceita o profile coerente já criado e apenas conclui seu workflow,
  sem duplicar profile nem marcar `verified=true`.

## Withdrawal preflight e negative scope

O CURRENT não expõe controller, service, worker ou use case operacional para solicitar, reservar,
aprovar, processar, executar ou pagar withdrawal. O schema, state machine, policy versionável e a
constante de risk são foundations, não um caminho executável. Portanto nenhum Seller — inclusive
`ACTIVE/verified=false` — consegue hoje iniciar ou concluir saque. Isso torna N segura sem alterar
withdrawal, mas **não** implementa nem promove O3: ainda não há enforcement de verificação em um
orquestrador de saque real.

Esta capability não implementa KYC/provider, badge de não verificado, withdrawal, payout,
STANDARD/EXPRESS, hold por mudança de e-mail, risk thresholds, checkout, fees, refund, dispute,
recovery, LIT Points, VIP, reputação, Q&A ou automação de mensagens.
