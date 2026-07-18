# EXTERNAL_SERVICES_DECISION_HANDOFF.md — handoff neutro de fornecedores externos

> O LIT Buy ainda não possui fornecedores externos definitivamente aprovados. As implementações e nomes presentes no código podem representar adapters de referência, provas técnicas ou opções provisórias. A decisão final deverá ser tomada pelo desenvolvedor responsável pelo staging e produção, após análise técnica, operacional e financeira.

Este documento prepara a decisão futura de fornecedores sem escolher hospedagem, infraestrutura, comunicação, pagamento, storage, CDN, observabilidade, filas, busca, chat, KYC, antifraude, analytics, backup ou qualquer outro serviço externo. Nenhum fornecedor citado no código, em documentação histórica ou em exemplos de ambiente deve ser interpretado como obrigatório ou aprovado para produção.

## Escopo e premissas

- A entrega é documental e não altera fluxos funcionais, adapters, banco, Docker, CI, frontend ou mocks.
- Resend e Twilio existem no backend de autenticação como implementações técnicas de referência, não como decisão comercial definitiva.
- O desenvolvedor futuro pode manter, substituir ou complementar adapters, desde que preserve ports, contratos, validações, errors públicos e separação de regras de negócio.
- Secrets reais devem ser criados e guardados fora do Git, em secret manager ou mecanismo equivalente do ambiente escolhido.
- Staging e produção só devem avançar depois de homologação real, revisão de segurança, revisão LGPD, backup/restore testado e aprovação explícita do proprietário.

## Estados padronizados de decisão

| Estado | Uso |
| --- | --- |
| `NOT_ANALYZED` | Ainda não analisado. |
| `UNDER_EVALUATION` | Análise iniciada, sem decisão. |
| `REFERENCE_IMPLEMENTATION` | Existe implementação técnica, mas sem aprovação definitiva. |
| `SELECTED_FOR_STAGING` | Escolhido apenas para staging, ainda sem aprovação de produção. |
| `APPROVED_FOR_PRODUCTION` | Aprovado após homologação, revisão e aprovação do proprietário. Não usado nesta sprint. |
| `REJECTED` | Descartado com justificativa registrada. |
| `MIGRATION_PLANNED` | Substituição planejada, com plano e prazo. |

## Status atual das decisões

| Categoria/serviço | Status | Observação |
| --- | --- | --- |
| Resend para e-mail de autenticação | `REFERENCE_IMPLEMENTATION` | Adapter real de referência existe, sem homologação com conta/credenciais reais neste handoff. |
| Twilio Programmable Messaging para SMS de autenticação | `REFERENCE_IMPLEMENTATION` | Adapter real de referência existe, sem homologação com conta/credenciais reais neste handoff. |
| Hospedagem de frontend | `NOT_ANALYZED` | Provedor, regiões, CDN, preview/staging e processo de deploy ainda pendentes. |
| Hospedagem de backend/API | `NOT_ANALYZED` | Runtime, escalabilidade, secrets, rede, TLS e health checks ainda pendentes. |
| PostgreSQL gerenciado | `NOT_ANALYZED` | Provedor, backups, restore, HA, migração e observabilidade pendentes. |
| Redis gerenciado | `NOT_ANALYZED` | Provedor, persistência, HA, política de eviction e segurança pendentes. |
| Armazenamento de arquivos | `NOT_ANALYZED` | Necessário para imagens, KYC, anexos, evidências e cofre futuro. |
| CDN/DNS/HTTPS | `NOT_ANALYZED` | Domínios, certificados, cache, WAF e roteamento pendentes. |
| Gestão de secrets | `NOT_ANALYZED` | Secret manager e rotação pendentes. |
| Backups e recuperação de desastre | `NOT_ANALYZED` | RPO/RTO, retenção, testes de restauração e runbooks pendentes. |
| Gateway de pagamentos | `NOT_ANALYZED` | Pix, boleto, cartão, split, escrow, webhooks, chargeback, saldo, saques e conciliação pendentes. |
| KYC/validação de identidade | `NOT_ANALYZED` | Documentos, biometria, revisão manual, retenção e LGPD pendentes. |
| Antifraude | `NOT_ANALYZED` | Score, regras, revisão manual, checkout, seller e afiliados pendentes. |
| Observabilidade/logs/métricas/alertas | `NOT_ANALYZED` | Stack, retenção, redaction e incidentes pendentes. |
| Filas/jobs | `NOT_ANALYZED` | Tecnologia, DLQ, idempotência e reprocessamento pendentes. |
| Busca | `NOT_ANALYZED` | Postgres FTS ou mecanismo dedicado ainda pendente. |
| Realtime/chat | `NOT_ANALYZED` | WebSocket/SSE/provider, moderação, anexos e auditoria pendentes. |
| Analytics | `NOT_ANALYZED` | Consentimento LGPD, eventos e provider pendentes. |
| Suporte/atendimento | `NOT_ANALYZED` | Canal, SLA, auditoria e retenção pendentes. |

## Matriz neutra de decisão

Use a mesma matriz para cada categoria. Ela orienta a análise, mas não produz vencedor automático.

| Critério | Pergunta a responder |
| --- | --- |
| Brasil | O serviço funciona plenamente no Brasil? |
| Custo inicial | Existe mensalidade mínima ou compromisso? |
| Custo em escala | Como o custo cresce com usuários e volume? |
| Portabilidade | É fácil substituir o fornecedor? |
| Integração | Existe SDK/API compatível com Node.js e NestJS? |
| Segurança | Há recursos adequados de segurança e auditoria? |
| LGPD | Há documentação e contratos adequados? |
| SLA | Existe garantia de disponibilidade? |
| Suporte | O suporte atende o estágio e o porte do projeto? |
| Webhooks | Há assinatura, idempotência e reprocessamento? |
| Sandbox | Existe ambiente de testes confiável? |
| Observabilidade | Há logs, métricas e status operacional? |
| Migração | Como exportar dados ou trocar de fornecedor? |
| Lock-in | Quanto código ou infraestrutura fica dependente da plataforma? |

## Inventário de decisões pendentes

### Infraestrutura e hospedagem

| Item | Necessidade | Estado atual | Implementações/mock | Decisão pendente | Critérios, riscos, impacto e momento recomendado |
| --- | --- | --- | --- | --- | --- |
| Frontend | Servir aplicação pública, previews e assets. | Build local documentado; staging remoto não implantado. | Dockerfile e compose servem apenas rehearsal local. | Provedor, pipeline, domínio, cache e preview. | Avaliar custo, CDN, rollback, logs, compatibilidade com Vite/TanStack. Decidir antes de staging público. |
| Backend/API | Executar NestJS `/api/v1` com health checks. | Backend real de autenticação existe local/CI. | `backend/Dockerfile` e compose local. | Runtime gerenciado/containers, rede, escalabilidade e deploy. | Risco de indisponibilidade e configuração insegura. Decidir antes de staging. |
| PostgreSQL | Fonte de verdade de autenticação e domínios futuros. | Prisma/migrations de auth existem. | Compose local usa PostgreSQL local. | Serviço gerenciado, HA, backups, restore e acesso privado. | Troca impacta URLs, migrations, backups e latência. Decidir antes de dados reais. |
| Redis | Rate limit/cache temporário de auth e filas futuras possíveis. | Módulo Redis existe; compose local usa Redis. | Sem provider externo. | Serviço gerenciado, HA, TLS, eviction e persistência. | Falha afeta autenticação/rate limits. Decidir antes de staging. |
| Armazenamento | Imagens, KYC, anexos, evidências, cofre. | Futuro; sem adapter real. | Uploads/entregas são mockados. | S3-compatible ou alternativa. | Lock-in de APIs e migração de objetos. Decidir antes de catálogo, KYC e chat reais. |
| CDN/DNS/HTTPS | Domínios, TLS, cache e proteção perimetral. | Somente templates e compose local. | Sem infraestrutura real. | DNS, certificados, CDN, WAF e headers. | Erros podem quebrar cookies/CORS/CSRF. Decidir antes de staging público. |
| Secrets | Guardar credenciais fora do Git. | `.env.*.example` usam placeholders. | Sem secret manager escolhido. | Secret manager, rotação e acesso. | Vazamento exige revogação. Decidir antes de qualquer credencial real. |
| Backups/DR | Recuperar banco, storage e configuração. | Não homologado. | Compose local não é backup real. | RPO/RTO, retenção, criptografia e testes de restore. | Sem restore testado não aprovar produção. Decidir antes de staging com dados importantes. |

### Comunicação

| Item | Necessidade | Estado atual | Implementações/mock | Decisão pendente | Critérios, riscos, impacto e momento recomendado |
| --- | --- | --- | --- | --- | --- |
| E-mail transacional | Verificação, reset, alteração de e-mail, 2FA/step-up e alertas. | Port de e-mail existe; `ResendAuthEmailAdapter` é referência. | Templates de auth no backend; service visual de e-mails no frontend permanece mockado. | Manter Resend ou substituir por outro fornecedor. | Avaliar entregabilidade BR, domínio, DKIM/SPF/DMARC, custo, logs, API, portabilidade. Decidir antes de staging real de auth. |
| SMS | Telefone, 2FA/step-up e alertas críticos. | Port de SMS existe; `TwilioAuthSmsAdapter` é referência. | Códigos gerados pelo backend; KYC visual antigo é mock. | Manter Twilio ou substituir por outro fornecedor. | Avaliar cobertura BR, custo por SMS, remetente, compliance, E.164, entrega e suporte. Decidir antes de staging real de auth. |
| Push futuro | Notificações in-app/push para eventos críticos. | Não implementado. | `NotificationProvider` é mockado. | Tecnologia, opt-in, service worker e fallback. | Risco LGPD e entrega. Decidir quando notificações reais entrarem no roadmap. |
| Templates, entregabilidade e status | Governança de conteúdo e rastreio de entrega. | Templates de auth em código; templates visuais no frontend. | Sem histórico real de entrega. | Onde versionar templates, webhooks/status e preferências. | Troca impacta auditoria, opt-out e suporte. Decidir junto com e-mail/SMS reais. |

### Pagamentos

| Item | Necessidade | Estado atual | Implementações/mock | Decisão pendente | Critérios, riscos, impacto e momento recomendado |
| --- | --- | --- | --- | --- | --- |
| Pix, boleto e cartão | Receber dinheiro real de compradores. | Checkout e pagamentos de marketplace são mockados. | `paymentService` e telas visuais; plano técnico existe. | Gateway/PSP e fluxo de tokenização. | Exige Brasil, PCI, sandbox, webhooks assinados, idempotência, conciliação. Decidir antes de qualquer pagamento real. |
| Split, escrow, saldo e saques | Separar plataforma/vendedor/afiliado e liberar valores. | Wallet/escrow são planejamento; sem ledger real fora de auth. | Services financeiros mockados. | Gateway com split ou ledger próprio + repasses. | Risco financeiro alto; troca impacta schema, ledger e operação. Decidir com dev sênior e revisão externa. |
| Webhooks, chargeback, estorno e conciliação | Confirmar pagamentos e tratar disputas. | Não implementado para marketplace. | Sem adapter real. | Assinatura, replay, idempotência, DLQ e reconciliação. | Falha duplica dinheiro ou perde eventos. Decidir antes do gateway. |
| Antifraude de pagamento | Reduzir fraude, chargeback e abuso. | Não implementado. | Regras visuais/admin mock. | Serviço externo, regras internas ou combinação. | Risco financeiro e reputacional. Decidir antes de produção financeira. |

### Identidade e conformidade

| Item | Necessidade | Estado atual | Implementações/mock | Decisão pendente | Critérios, riscos, impacto e momento recomendado |
| --- | --- | --- | --- | --- | --- |
| KYC/documentos/biometria | Verificar vendedores/saques e reduzir fraude. | KYC é visual/mockado. | `verificationService` mockado. | Fornecedor KYC, revisão manual, storage e retenção. | LGPD sensível; troca impacta dados biométricos/documentais. Decidir antes de seller financeiro/saques. |
| LGPD/termos/consentimentos | Base legal, direitos do titular e consentimento. | Documentos institucionais existem como conteúdo do projeto, sem revisão jurídica final registrada aqui. | Sem provider. | Juridico, CMP/consent, retenção/exclusão. | Risco legal. Decidir antes de produção pública. |
| Retenção e exclusão de dados | Cumprir direitos e obrigações legais. | Sem política operacional homologada. | Sem jobs reais. | Prazos por domínio e automatização. | Apagamento indevido ou retenção excessiva. Decidir antes de dados reais sensíveis. |

### Operação da plataforma

| Item | Necessidade | Estado atual | Implementações/mock | Decisão pendente | Critérios, riscos, impacto e momento recomendado |
| --- | --- | --- | --- | --- | --- |
| Observabilidade/logs/métricas/alertas | Diagnosticar incidentes e SLO. | Logger/redaction backend existem; stack externa não escolhida. | Sem coleta centralizada real. | Ferramentas, retenção, PII redaction e alertas. | Sem alerta, incidentes passam despercebidos. Decidir antes de staging. |
| Filas/jobs | E-mails, webhooks, conciliação, expiração e notificações. | Não há fila externa escolhida. | Jobs reais de marketplace não implementados. | Redis queue, broker gerenciado ou outro. | Risco de perda/duplicação; exige idempotência. Decidir antes de processos assíncronos críticos. |
| Busca | Catálogo pesquisável e ranking. | Busca frontend é mock/cliente. | `searchService` mockado; roadmap cita FTS/opções. | Postgres FTS ou serviço dedicado. | Troca impacta indexação e relevância. Decidir na fase catálogo. |
| Realtime/chat | Conversas, mediação e suporte. | Chat é mockado. | `messageService` mockado. | WebSocket/SSE/provider, moderação, anexos e auditoria. | Risco de vazamento/abuso. Decidir antes de pedidos reais com chat. |
| Analytics | Métricas de produto e funil. | Eventos documentados como mockados. | `analyticsService` não envia eventos reais. | Provider, consentimento, eventos e retenção. | LGPD e qualidade de dados. Decidir antes de growth/produção. |
| Suporte e atendimento | Resolver incidentes, pagamentos e disputas. | Contato/suporte visual e mockado. | Sem ticketing real. | Ferramenta, SLA, autenticação e auditoria. | Falta de rastreabilidade. Decidir antes de usuários reais. |

## Resend e Twilio como implementações de referência

Classificação: **IMPLEMENTAÇÃO DE REFERÊNCIA — FORNECEDOR NÃO APROVADO DEFINITIVAMENTE**.

### ResendAuthEmailAdapter

- Implementa o port `AuthEmailPort` para finalidades de autenticação como verificação de e-mail, reset de senha, aprovação de dispositivo, alteração de e-mail, 2FA/step-up e alertas.
- Usa configuração `AUTH_EMAIL_DELIVERY_MODE=external` e `AUTH_EMAIL_PROVIDER=resend` com variáveis `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `RESEND_FROM_NAME`, `RESEND_REPLY_TO` opcional e `AUTH_EXTERNAL_DELIVERY_TIMEOUT_MS`.
- Testes automatizados cobrem seleção do provider, payloads esperados, timeout, falhas de fetch/configuração e mapeamento para `EMAIL_DELIVERY_UNAVAILABLE` em `backend/src/auth/auth.external-adapters.spec.ts`, `backend/src/auth/auth.providers.spec.ts` e validação de ambiente em `backend/src/config/env.schema.spec.ts`.
- Não há registro neste handoff de homologação real com domínio verificado, credenciais reais, inboxes reais ou métricas reais de entregabilidade.
- Para substituir, criar outro adapter que implemente `AuthEmailPort`, preservar purposes/templates ou contrato equivalente, registrar via DI/configuração, manter timeout/redaction e mapear indisponibilidade para `EMAIL_DELIVERY_UNAVAILABLE`.

### TwilioAuthSmsAdapter

- Implementa o port `AuthSmsPort` para telefone, códigos 2FA/step-up e alertas de segurança.
- Usa configuração `AUTH_SMS_DELIVERY_MODE=external` e `AUTH_SMS_PROVIDER=twilio` com `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` e exatamente uma estratégia de remetente: `TWILIO_MESSAGING_SERVICE_SID` ou `TWILIO_FROM_NUMBER` em E.164, além de `AUTH_EXTERNAL_DELIVERY_TIMEOUT_MS`.
- Testes automatizados cobrem seleção do provider, remetente, validação E.164, timeout, falhas de fetch/configuração e mapeamento para `SMS_DELIVERY_UNAVAILABLE` em `backend/src/auth/auth.external-adapters.spec.ts`, `backend/src/auth/auth.providers.spec.ts` e validação de ambiente em `backend/src/config/env.schema.spec.ts`.
- Não há registro neste handoff de homologação real com conta, remetente aprovado, telefone real controlado ou métricas reais de entrega.
- Para substituir, criar outro adapter que implemente `AuthSmsPort`, preservar purposes, manter códigos gerados pelo backend, validar E.164, registrar via DI/configuração e mapear indisponibilidade para `SMS_DELIVERY_UNAVAILABLE`.

## Guia de substituição por ports e adapters

### E-mail

O novo adapter deve implementar o port existente de e-mail, preservar purposes, preservar templates ou contrato equivalente, mapear falhas para `EMAIL_DELIVERY_UNAVAILABLE`, respeitar timeout, evitar logs sensíveis, ser registrado por injeção de dependência, ser selecionado por configuração e manter os fluxos do `AuthService` independentes do fornecedor.

### SMS

O novo adapter deve implementar o port existente de SMS, preservar purposes, preservar códigos gerados pelo backend, mapear falhas para `SMS_DELIVERY_UNAVAILABLE`, validar E.164, respeitar timeout, evitar logs sensíveis, ser registrado por injeção de dependência e não transformar o fornecedor em fonte de verdade dos challenges.

### Outros serviços futuros

Pagamentos, KYC, armazenamento, busca, chat, notificações, antifraude e observabilidade devem seguir o mesmo padrão: domínio define port/contrato, adapter contém detalhes do fornecedor, configuração seleciona implementação, erros externos são mapeados para códigos internos, webhooks são assinados/idempotentes e secrets permanecem fora do Git.

## Variáveis de ambiente e secrets

- As variáveis existentes documentam a configuração atual, mas nomes como `RESEND_*` e `TWILIO_*` não significam aprovação definitiva desses fornecedores.
- Caso um fornecedor seja substituído, novas variáveis podem ser adicionadas e variáveis antigas devem ser depreciadas de forma controlada, mantendo compatibilidade durante a migração quando necessário.
- Secrets nunca devem entrar no Git; exemplos devem usar placeholders claramente fictícios.
- Variáveis públicas (`VITE_*`, origins públicos, flags visuais) e privadas (tokens, DSNs, peppers, API keys) devem permanecer separadas.
- Placeholders não representam configuração real e validação de ambiente deve permanecer fail-closed em staging/production.
- Não renomear variáveis atuais apenas para torná-las genéricas; isso quebraria adapters de referência sem benefício operacional imediato.

## Checklist para o desenvolvedor futuro

### Antes de recomendar

- [ ] Revisar arquitetura.
- [ ] Estimar tráfego.
- [ ] Estimar volume de transações.
- [ ] Estimar volume de e-mails.
- [ ] Estimar volume de SMS.
- [ ] Estimar armazenamento.
- [ ] Levantar requisitos legais.
- [ ] Levantar orçamento.
- [ ] Comparar pelo menos duas opções relevantes.
- [ ] Verificar documentação e suporte.
- [ ] Verificar custos de saída e migração.

### Antes de staging

- [ ] Registrar decisão provisória.
- [ ] Criar contas empresariais.
- [ ] Configurar acessos.
- [ ] Configurar secrets fora do Git.
- [ ] Configurar domínio.
- [ ] Configurar HTTPS.
- [ ] Configurar banco e Redis.
- [ ] Configurar backups.
- [ ] Executar migrations.
- [ ] Executar smoke tests.
- [ ] Testar falhas e rollback.

### Antes de produção

- [ ] Homologação real.
- [ ] Revisão profissional.
- [ ] Revisão de segurança.
- [ ] Revisão LGPD.
- [ ] Teste de backup.
- [ ] Teste de restauração.
- [ ] Observabilidade.
- [ ] Alertas.
- [ ] Limites de custos.
- [ ] Plano de incidentes.
- [ ] Plano de migração.
- [ ] Aprovação explícita do proprietário.

## Uso do template

Antes de mover qualquer serviço para `SELECTED_FOR_STAGING` ou `APPROVED_FOR_PRODUCTION`, copie `EXTERNAL_SERVICE_DECISION_TEMPLATE.md`, preencha a análise da categoria e registre aprovação explícita do proprietário. Nenhum item deste handoff deve ser tratado como aprovação automática.

## Seller onboarding foundation (2026-07-18)

- Adicionado onboarding real de vendedor sem KYC externo: solicitação persistida, análise administrativa, aprovação/rejeição, criação de perfil inicial e concessão atômica do papel `SELLER`.
- Novos modelos: `SellerApplication` e `SellerProfile`; `SellerProfile.verified` nasce `false` e não representa KYC.
- Produtos, anúncios, vendas, financeiro, reputação, wallet, saques, documentos, selfie e verificação externa continuam mockados ou pendentes para sprints futuras.
- Fornecedor de KYC permanece não escolhido (`NOT_ANALYZED`); nenhum documento real deve ser enviado.
- Consulte `SELLER_ONBOARDING_FOUNDATION.md` para escopo, endpoints, estados e limitações.
