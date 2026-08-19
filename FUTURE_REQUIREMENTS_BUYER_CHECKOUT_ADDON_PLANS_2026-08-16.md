# LIT Buy — Requisito futuro: planos adicionais no checkout do Buyer

> **OWNER TARGET SUPERSEDED IN PART (2026-08-18):** `Sem Plano`, VIP Básico 2,99% and VIP Premium 4,99%, with benefits/SLAs, are frozen in `OWNER_COMMERCIAL_FINANCIAL_DECISION_FREEZE_2026-08-18.md`. This file remains historical future scope; enforcement, legal and technical design remain pending.


## Finalidade

Este documento registra uma decisão/requisito de produto levantado pelo owner durante a validação funcional de 2026-08-16.

A referência conceitual apresentada foi uma etapa de checkout semelhante à usada por marketplaces como a GGMAX, em que o comprador pode escolher um **plano adicional pago** antes de concluir a compra.

O objetivo no LIT Buy é criar uma nova fonte de receita da plataforma sem misturar essa cobrança com o preço do Seller e sem apresentar benefício fictício.

Este documento é **somente registro de requisito futuro**. Ele não autoriza implementação imediata, não reabre o Alpha, não altera o feature freeze e não declara qualquer plano como disponível hoje.

---

## 1. Decisão de produto registrada

O checkout do Buyer deverá, em uma fase futura, possuir uma etapa opcional de **Plano adicional / Proteção adicional / Benefícios adicionais** antes da confirmação final do pagamento.

A experiência desejada é:

1. Buyer revisa os itens e valores da compra;
2. Buyer visualiza uma oferta clara de um ou mais planos adicionais da própria LIT Buy;
3. Buyer pode selecionar um plano pago ou escolher explicitamente **prosseguir sem plano adicional**;
4. o valor adicional escolhido entra de forma transparente no resumo final;
5. somente depois disso o Buyer confirma o pagamento.

A opção sem plano deve continuar disponível e clara. O produto não deve usar dark pattern para esconder a opção gratuita ou induzir contratação involuntária.

---

## 2. Modelo comercial pretendido

A intenção é que o plano adicional seja uma **receita da plataforma LIT Buy**, e não um valor definido pelo Seller.

Podem existir, por exemplo, dois níveis comerciais, como:

- plano adicional básico;
- plano adicional premium.

Os nomes finais, identidade visual, preço, percentual e benefícios ainda são `DECISION REQUIRED`.

A referência visual externa apresentada pelo owner possui níveis com cobrança percentual adicional e benefícios diferenciados. O LIT Buy pode usar o mesmo conceito de monetização, mas deve possuir nomes, design, regras e contrato próprios.

Não copiar branding, mascotes, textos ou identidade visual de terceiros.

---

## 3. Exemplos de benefícios possíveis

Os benefícios abaixo são somente candidatos e precisam ser validados antes da implementação:

- atendimento com SLA diferenciado;
- prioridade em suporte/moderação quando contratualmente permitido;
- janela de suporte estendida;
- prazo operacional menor para determinada etapa de atendimento/reclamação;
- benefícios de fidelidade/pontos, caso exista um sistema real de pontos;
- outros benefícios concretos e mensuráveis.

Regra obrigatória:

> Nenhum benefício pode ser anunciado se não existir enforcement real no backend/processo operacional.

Exemplos que exigem cuidado especial:

- “reclamação em X horas” só pode existir se o domínio de disputa e os SLAs suportarem essa regra;
- “reembolso acelerado” não pode significar ignorar análise de fraude, PSP, chargeback ou direitos do Seller;
- “suporte por N dias” precisa ter início, término e escopo bem definidos;
- pontos/cashback só podem aparecer quando houver ledger/regra real correspondente.

---

## 4. Posição no checkout

O plano adicional deve ser escolhido **antes da criação/confirmação final do pagamento** e precisa fazer parte do snapshot comercial autoritativo do checkout/order.

O Buyer deve visualizar, no mínimo:

- nome do plano;
- preço fixo ou percentual aplicável;
- valor monetário exato que será acrescentado à compra;
- lista objetiva de benefícios;
- indicação de que é opcional;
- opção clara de continuar sem plano;
- total final da compra já incluindo o adicional selecionado.

O frontend nunca será autoridade para calcular sozinho o valor final.

---

## 5. Autoridade server-side e snapshot

Quando implementado, o backend deve ser autoridade para:

- quais planos estão ativos;
- versionamento das regras do plano;
- preço fixo/percentual;
- elegibilidade;
- benefícios contratados;
- cálculo do adicional;
- total final;
- validade temporal da oferta.

O checkout deve persistir um snapshot imutável suficiente para auditoria, incluindo algo equivalente a:

- `buyerAddonPlanId`;
- `buyerAddonPlanVersion`;
- `buyerAddonPlanNameSnapshot`;
- `buyerAddonAmountMinor`;
- `buyerAddonPricingType`;
- `buyerAddonRateSnapshot`, quando percentual;
- benefícios/entitlements relevantes ou referência versionada à política;
- escolha explícita `NONE` quando não houver plano.

Os nomes acima são apenas direção conceitual, não schema aprovado.

---

## 6. Idempotência e integridade financeira

A inclusão do plano não pode quebrar os invariantes já existentes de checkout/pagamento.

Requisitos futuros mínimos:

- replay de checkout com a mesma intenção não pode duplicar o adicional;
- replay de pagamento não pode reconhecer a receita do plano duas vezes;
- total do pedido deve reconciliar com itens + descontos + taxas aplicáveis + plano adicional;
- Ledger continua double-entry;
- receita do plano deve ser contabilizada separadamente da receita/bruto do Seller;
- o Seller não deve receber crédito por um adicional que pertence à plataforma;
- comissão da venda e receita do plano não devem ser confundidas;
- qualquer mudança de seleção antes do fechamento deve alterar versão/fingerprint do checkout conforme o contrato futuro.

---

## 7. Refund, cancelamento, disputa e chargeback

A política de devolução do valor do plano adicional precisa ser definida antes de produção.

`DECISION REQUIRED` para, entre outros casos:

- checkout/pedido cancelado antes do pagamento;
- pagamento aprovado e pedido posteriormente cancelado;
- refund total;
- refund parcial;
- Buyer vence disputa;
- Seller vence disputa;
- chargeback;
- fraude;
- benefício já consumido parcialmente antes do refund.

A implementação deve evitar ganho ou perda financeira duplicada e gerar reversões de Ledger idempotentes quando aplicável.

A política final precisa ser compatível com PSP, termos de uso, direito do consumidor e revisão jurídica.

---

## 8. Relação com Seller

O plano adicional pertence ao contrato **Buyer ↔ plataforma**.

Por padrão, o Seller:

- não define o preço do plano;
- não recebe o adicional como receita da venda;
- não pode alterar os benefícios;
- não deve ter seu payout aumentado pelo valor do plano;
- continua sujeito ao contrato normal do pedido e disputa.

Se algum benefício futuro alterar operacionalmente prazos relacionados ao Seller, isso precisa ser explicitamente modelado e juridicamente revisado para não criar regras contraditórias.

---

## 9. Administração futura

É desejável que os planos sejam configuráveis pela plataforma, não hardcoded no frontend.

Uma futura superfície Admin poderá controlar, com autorização server-side e auditoria:

- ativo/inativo;
- nome comercial;
- descrição;
- preço/percentual;
- versão da política;
- benefícios;
- período de vigência;
- ordem de exibição;
- elegibilidade por categoria/tipo de produto, se necessário.

Alterações de preço não devem modificar retroativamente pedidos já criados.

---

## 10. Métricas de negócio

Quando implementado, registrar eventos suficientes para medir:

- impressões da oferta;
- seleção de cada plano;
- escolha “sem plano”;
- conversão do checkout;
- receita incremental do adicional;
- attach rate por plano;
- cancelamento/refund/chargeback por plano;
- impacto na conversão geral;
- utilização real dos benefícios.

Analytics não pode conter segredo, credencial, dado financeiro sensível desnecessário ou PII além do permitido.

---

## 11. Regras de UX e transparência

A UI futura deve:

- mostrar preço e total claramente;
- permitir comparação simples entre níveis;
- ter opção inequívoca de continuar sem plano;
- não pré-selecionar silenciosamente um plano pago sem decisão explícita de produto/jurídico;
- não usar benefícios falsos ou números decorativos;
- não confundir o plano com seguro regulado se juridicamente ele não for um seguro;
- evitar promessas absolutas que a operação não consiga cumprir.

A nomenclatura “proteção”, “garantia”, “seguro”, “VIP” ou equivalente deve ser revisada juridicamente antes do lançamento.

---

## 12. Estado e classificação

**Classificação atual:** `FUTURE-SCOPE / DECISION REQUIRED / MONETIZATION`.

Não é blocker do Handoff Alpha atual.

Não deve ser implementado durante a auditoria funcional Seller em andamento.

Antes de implementação, precisam ser definidos pelo menos:

1. quantidade de planos;
2. nomes e branding próprios;
3. preço fixo versus percentual;
4. percentuais/valores finais;
5. benefícios reais e mensuráveis;
6. política de refund/reversão;
7. contabilização no Ledger;
8. relação com disputa/chargeback;
9. configuração/Admin;
10. termos jurídicos e comunicação ao consumidor.

---

## 13. Regra de preservação

Este requisito não deve desaparecer quando o projeto avançar para handoff humano ou productionização.

Ao planejar a evolução do checkout Buyer, revisar este documento juntamente com:

- `ALPHA_SCOPE_AND_COMPLETION_CHECKLIST.md`;
- `FINAL_FUNCTIONAL_AUDIT_BLOCK_3_BUYER_PROGRESS.md`;
- `FINAL_FUNCTIONAL_AUDIT_REPORT.md`;
- `FUTURE_REQUIREMENTS_INVENTORY_DISPUTE_LIFECYCLE_2026-08-16.md`;
- contratos financeiros/checkout/ledger vigentes naquele momento.

A implementação futura deve preservar idempotência, snapshots comerciais, Ledger balanceado, ownership e demais invariantes já consolidados no LIT Buy.
