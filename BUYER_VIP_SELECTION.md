# Buyer VIP selection — Q1

## Owner target e autoridade

Q1 materializa no checkout Buyer uma escolha explícita entre **Sem plano** (`NONE`), **VIP Básico** (`BASIC`) e **VIP Premium** (`PREMIUM`). O backend valida o enum e é a única autoridade; o cliente não envia taxa, valor, multiplicador, SLA ou benefícios.

A interface começa sem seleção (`UNSELECTED`). Nenhuma opção, inclusive `NONE`, é assumida silenciosamente e nenhuma opção paga é pré-selecionada. As três alternativas têm o mesmo controle acessível por teclado e nomes neutros.

## Snapshot autoritativo

Todo Order criado pelo checkout Q1 congela `buyerVipSelectionVersion = 1` e `buyerVipPlanSnapshot` com uma das três escolhas. O `CHECK` PostgreSQL aceita somente o par `NULL/NULL` legado ou o par completo v1/plano, e um trigger impede alteração posterior.

Orders anteriores continuam `NULL/NULL`: ausência histórica não é reinterpretada nem backfillada como a escolha explícita `NONE`. Um novo Order com `NONE` registra v1/`NONE`.

A seleção integra tanto o hash canônico da request quanto o fingerprint derivado do preview. Assim, replay com mesma chave e seleção devolve a resposta anterior; a mesma chave com outra seleção falha como reutilização de idempotência, sem trocar o snapshot.

## Limites financeiros e operacionais

**Q1 selection snapshot != fee. Q1 selection snapshot != entitlement.**

Q1 não altera `subtotalAmountMinor` nem `totalAmountMinor`, não cria componente de fee Buyer VIP, conta ou posting de Ledger e não muda proceeds do Seller, reconhecimento, pagamento ou refund. `BASIC` e `PREMIUM` são somente identidades congeladas, sem taxa aplicada.

A seleção também não ativa pontos, prioridade, triagem/SLA, suporte estendido, refund acelerado ou qualquer vantagem econômica ou operacional. A UI não promete esses efeitos. Q2 (fee), R1/R2/R3 (operações) e T/S (LIT Points) permanecem capabilities separadas; configuração Admin também fica fora de Q1.

## Negative scope

Não fazem parte desta capability: Buyer VIP fee/rate/amount, LP, calendários ou deadlines, suporte, refund/recovery, PSP, payment split, Ledger, KYC, withdrawal, risco, disputas e configuração Admin. Nenhum mock ou consumer legado desses domínios consome o snapshot Q1.
