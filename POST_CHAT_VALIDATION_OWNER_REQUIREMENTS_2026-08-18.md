# LIT Buy — Requisitos do Owner após validação do Order Chat — 2026-08-18

## Finalidade, contexto e autoridade

Este documento consolida decisões e follow-ups do Owner descobertos durante a validação funcional real do Order Chat em 2026-08-18. É um índice de rastreabilidade: **não substitui** `ALPHA_SCOPE_AND_COMPLETION_CHECKLIST.md`, `ORDER_CHAT_CONTRACT.md`, `POST_FREEZE_BROWSER_QA_FINDINGS.md` nem autoridades específicas de domínio.

O `ORDER_CHAT_CONTRACT.md` permanece o contrato V1 corrente. Os requisitos novos abaixo são pós-V1, não ampliam silenciosamente o contrato implementado e não autorizam implementação por si sós. Nenhum item classificado como `NOT IMPLEMENTED` deve ser apresentado como capability real.

## Evidência funcional obtida

- **Main testada:** `43ee89c94b2e23f2bc1bee0d4e6920a0cc97a385`.
- **Ambiente:** rehearsal local com `docker-compose.staging.yml`, PostgreSQL/Redis/MinIO reais e `FAKE_ALPHA` apenas como modo local não produtivo.
- **Order reutilizado:** `LIT-JVFUAQZ4U6CXCG`, em estado `ACTIVE/PAID` no início do recorte.
- Buyer autenticado abriu o detalhe real, viu o chat e enviou `teste`.
- Seller abriu a venda do mesmo Order em outra sessão/navegador, recebeu a mensagem sem `F5` e respondeu `teste ok`.
- Buyer recebeu a resposta sem `F5`; ambas as sessões permaneceram conectadas simultaneamente.
- Depois de `F5` nas duas sessões, as duas mensagens continuaram presentes.

O recorte comprova funcionalmente, no ambiente descrito, polling Buyer ↔ Seller e persistência do histórico via backend/PostgreSQL. **Não conclui a CHAT-PR-D inteira**: ainda faltam outras validações planejadas, incluindo ao menos continuidade em `Order COMPLETED`, se aplicável. Não é evidência de produção, WebSocket, push, PSP real ou dinheiro real.

## V1 já implementada versus follow-ups

A capability V1 observada e implementada neste corte é o chat textual pós-compra do Order elegível, embutido nos detalhes reais de Buyer e Seller, com troca bidirecional por REST/polling e histórico persistente. Seus limites e critérios continuam definidos pelo `ORDER_CHAT_CONTRACT.md`; a evidência parcial acima não declara todos os critérios de aceitação concluídos.

Não estão implementados por esta PR documental: redesign visual, superfície bloqueada pré-pagamento, system notices, notificações reais account-wide, Product Q&A público ou planos adicionais Buyer/VIP. Nenhum schema, API, Admin, backend, frontend, Prisma, migration, teste ou CI foi alterado.

## Matriz consolidada

| Item | Status | Classificação / relação |
| --- | --- | --- |
| Evidência Buyer ↔ Seller em `ACTIVE/PAID`, polling e persistência após `F5` | `REAL-TESTED` no recorte local descrito | Evidência parcial da CHAT-PR-D; demais critérios continuam pendentes |
| UX visual ampliada do Order Chat | `OWNER REQUIREMENT / NOT IMPLEMENTED` | `PRE-HANDOFF CANDIDATE`; `NON_BLOCKER` da validação atual; QA-BROWSER-014 |
| Chat visível, porém bloqueado em `PENDING_PAYMENT` | `OWNER REQUIREMENT / NOT IMPLEMENTED` | `PRE-HANDOFF CANDIDATE`; somente UX, sem mensagem pré-elegibilidade; QA-BROWSER-014 |
| `SYSTEM / LIT BUY SYSTEM NOTICE` persistente e configurável | `OWNER REQUIREMENT / NOT IMPLEMENTED / DECISION REQUIRED` | `PRE-HANDOFF CANDIDATE`; schema/API/Admin a definir; QA-BROWSER-015 |
| Notificações reais account-wide | `OWNER REQUIREMENT / CURRENT SYSTEM = MOCK / NOT IMPLEMENTED` | `PRE-HANDOFF CANDIDATE`; QA-BROWSER-016 e QA-BROWSER-001 |
| Product Q&A público | `OWNER REQUIREMENT / NOT IMPLEMENTED` | `SEPARATE INCREMENT`; relacionado a QA-BROWSER-006; não misturar com Order Chat |
| Buyer addon/VIP básico-premium | `FUTURE-SCOPE / DECISION REQUIRED / NOT IMPLEMENTED` | Autoridade própria: `FUTURE_REQUIREMENTS_BUYER_CHECKOUT_ADDON_PLANS_2026-08-16.md` |

## Follow-ups do Order Chat

### UX visual própria da LIT Buy

A apresentação atual é funcional, mas simples demais. A direção desejada é uma conversa maior, cabeçalho claro, mensagens separadas, diferenciação `SELF`/`COUNTERPARTY`/`SYSTEM`, timestamps, separadores de data quando úteis, avisos em área própria, composer fixo ou claramente identificado na base e comportamento adequado com histórico maior. A inspiração pode ser conceitual em marketplaces maduros, sem copiar branding, textos, mascotes, assets ou identidade visual de terceiros.

### Superfície bloqueada antes do pagamento

Em `PENDING_PAYMENT`, a superfície poderá ficar visível com título como `Chat com o vendedor`, orientação como `Para iniciar a conversa, aguarde a confirmação do pagamento.` e composer desabilitado. Isso é somente UX: não pode haver conversa utilizável nem `POST` antes da elegibilidade; o backend permanece autoridade; o desbloqueio depende de `PAID + ACTIVE` conforme o contrato; nenhum timeout deve ser inventado e o frontend não pode ser a única barreira.

### Mensagem automática do sistema

Após o chat se tornar elegível, deve ser possível criar aviso próprio `SYSTEM / LIT BUY SYSTEM NOTICE`, nunca uma mensagem falsa do Seller. O aviso desejado é persistente, imutável naquele histórico, identificado como LIT Buy, sem `senderUserId` falso, sem efeitos em Order/Payment/Fulfillment/Ledger, idempotente, sem duplicação em replay e criado sem depender do frontend.

O texto será configurável pelo Admin. Configuração e materialização precisam de versionamento/estado para que alterações futuras não reescrevam retroativamente avisos de Orders antigos. Schema, API e superfície Admin exatos ainda exigem desenho antes da implementação.

## Notificações pertencem à conta/User

Decisão explícita do Owner: **notificação pertence à conta/User, não ao `activeRole` da interface**. Uma mesma User pode ser Buyer e Seller; eventos de compra devem continuar visíveis no modo Seller e eventos de venda no modo Buyer. `activeRole` serve apenas à apresentação e navegação.

Para mensagens do Order Chat:

- Buyer envia → `recipientUserId` é o User do Seller do Order;
- Seller envia → `recipientUserId` é o Buyer do Order;
- o autor nunca recebe a própria notificação.

A implementação futura requer backend persistente, `recipientUserId` obrigatório, acesso owner-only, unread/read persistente, tipo de nova mensagem, referências a Order e mensagem, idempotência, sino account-wide, privacidade no estado anônimo e ausência de dependência do mock atual. Polling ou equivalente inicial é aceitável; WebSocket não é obrigatório.

O clique navega para `/pedidos/<publicCode>` quando o destinatário é Buyer e para `/vendedor/vendas/<publicCode>` quando é Seller, independentemente do modo visual atual. O estado mock e a exposição anônima continuam abertos em QA-BROWSER-001; este registro não declara correção.

## Order Chat e Product Q&A são domínios diferentes

Order Chat é privado, pós-compra e vinculado a um Order elegível. Product Q&A é pré-compra e público no anúncio/produto: Buyer autenticado pergunta, o Seller proprietário responde e visitantes do produto podem ler perguntas e respostas.

Product Q&A deve possuir backend e persistência reais; o frontend mock existente não é implementação. Quando implementado em incremento separado, deve aparecer abaixo das informações/descrição do produto. A ausência já se relaciona a `QA-BROWSER-006`; não foi criado finding duplicado.

## Buyer addon / VIP básico-premium

Em 2026-08-18, o Owner **reconfirmou** que deseja planos adicionais para o Buyer, conceitualmente semelhantes a níveis básico/premium. O requisito já está preservado e sua única autoridade detalhada continua sendo `FUTURE_REQUIREMENTS_BUYER_CHECKOUT_ADDON_PLANS_2026-08-16.md`.

O item continua `NOT IMPLEMENTED`; a UI antiga `CheckoutProtectionPlanSection` é demonstrativa/mock. Qualquer implementação real depende das decisões financeiras e comerciais enumeradas no documento autoritativo. Este consolidador não duplica nem altera esse contrato futuro.

## Regra de governança e ALPHA_SCOPE

Registrar requisitos ou classificá-los como candidatos pré-handoff não altera automaticamente o Alpha, seus blockers ou sua linha de chegada. `ALPHA_SCOPE_AND_COMPLETION_CHECKLIST.md` permanece intacto. Qualquer mudança de escopo exige decisão formal separada na autoridade apropriada; esta PR documental não faz essa mudança.
