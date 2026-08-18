# Payment provider strategy

## Estado da decisão em 2026-08-17

Não existe PSP produtivo final homologado. A preferência atual do owner para o mercado brasileiro é **Mercado Pago**, especialmente por Pix; isso representa candidato/preferência atual, não integração concluída, seleção contratual final ou aprovação para produção.

A arquitetura permanece provider-agnostic atrás de `PaymentProviderPort`. O adapter Efí existente permanece como boundary/foundation real de sandbox já construída e não deve ser apagado ou tratado como inútil. Efí não está homologado para produção. Mercado Pago não está integrado; split, escrow e payout Mercado Pago não estão implementados.

A seleção final exige avaliação técnica, comercial, regulatória e contratual, seguida de homologação explícita. Esta reconciliação não muda SDK, configuração ou runtime e não habilita dinheiro real.

## Autoridade financeira e settlement

Nenhum PSP externo se torna a contabilidade autoritativa da plataforma. O Ledger interno LIT Buy continua autoritativo para taxas/comissões, `PENDING`, `HELD`, `AVAILABLE`, `RESERVED`, `DEFICIT`, regras de liberação e futuras regras de withdrawal. Eventos de provider são entradas externas a reconciliar, não uma segunda fonte de verdade.

A foundation atual não prova checkout produtivo, split real, escrow real, payout, Pix Cash-Out, saque, refunds/chargebacks operacionais ou KYC produtivo. Qualquer modelo de receipt, custody/retention, settlement e catálogo exige aprovação escrita e revisão humana sênior.

## Gate produtivo obrigatório

Antes de qualquer enablement produtivo são necessários provider final homologado para o modelo e catálogo reais, contratos e análise regulatória, configuração explícita, runbooks operacionais, reconciliação/monitoramento e release separadamente revisado. Efí segue como adapter de referência/sandbox; Mercado Pago segue como preferência/candidato Brasil/Pix. Nenhum dos dois é aqui aprovado para produção.
