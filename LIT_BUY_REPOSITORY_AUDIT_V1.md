# LIT Buy — Auditoria Integral do Repositório

**Versão:** 1.0  
**Data:** 13 de julho de 2026  
**Escopo:** análise estática de todos os arquivos relevantes do ZIP `litbuy-hub-main.zip`, confronto com o Documento Mestre V2 e definição da base para o Codex.

---

## 1. Conclusão executiva

O repositório está suficientemente completo para orientar a construção do back-end por prompts. O front é um MVP visual amplo, não um esqueleto vazio. Existem contratos de UI, tipos, services mockados e documentos para praticamente todos os módulos relevantes.

A auditoria confirma, entretanto, que os valores e regras dos mocks **não podem ser convertidos diretamente em back-end**. Há várias versões históricas de tarifa, prazo, LIT Points, KYC e Supabase. O `LIT_BUY_BACKEND_MASTER_SPEC_V2.md` resolve a precedência e deve ser citado em todos os prompts do Codex.

Não é necessário apagar ou mover os documentos antigos. Eles permanecem como referência histórica. O Codex deverá tratá-los como subordinados ao Documento Mestre V2.

## 2. Cobertura e limitações

- Arquivos inventariados: **404**.
- Arquivos de texto/configuração lidos: **402**.
- Único conteúdo binário relevante: favicon; não contém regra de negócio.
- Todos os `.ts`, `.tsx`, `.md`, JSON e configurações foram incluídos na varredura estática.
- Os services, providers, rotas, tipos e principais componentes de fluxo foram confrontados.
- Não existem arquivos de teste automatizado no repositório.
- A instalação não pôde ser concluída neste ambiente: `npx bun install` falhou ao baixar pacotes de Motion/Framer Motion por conexão recusada. Portanto, lint, typecheck e build não foram reexecutados aqui. A documentação registra build/typecheck anteriores, mas o Codex deverá executar novamente no ambiente conectado.

## 3. Inventário técnico

| Item | Resultado |
|---|---:|
| Arquivos totais | 404 |
| TSX | 314 |
| TypeScript `.ts` | 43 |
| Markdown | 35 |
| Arquivos de rota | 65 |
| Services mockados | 29 |
| Providers globais | 3 |
| Tipos/interfaces/enums exportados | 261 |
| Testes automatizados | 0 |

### 3.1 Stack real encontrada

- React 19;
- TypeScript strict;
- TanStack Start e TanStack Router;
- Vite;
- TanStack Query;
- Tailwind CSS 4;
- Radix/shadcn;
- React Hook Form + Zod;
- Bun como gerenciador indicado;
- entrada SSR em `src/server.ts` e middleware em `src/start.ts`;
- nenhum Laravel, PHP, NestJS, Prisma, banco ou API de domínio existentes.

### 3.2 Decisão técnica

A opção recomendada e congelada para a fundação é criar uma API NestJS separada em `backend/`, mantendo o front na estrutura atual. Isso evita reestruturação prematura, reaproveita TypeScript e isola autenticação, permissões e financeiro do runtime do front.

## 4. Rotas e superfícies funcionais

### 4.1 Públicas

| Rota | Arquivo | Services diretamente usados |
|---|---|---|
| `/` | `src/routes/index.tsx` | productService |
| `/afiliados` | `src/routes/afiliados.tsx` | affiliateService, analyticsService |
| `/ajuda` | `src/routes/ajuda.tsx` | analyticsService, infoService |
| `/buscar` | `src/routes/buscar.tsx` | productService, searchService |
| `/cadastro` | `src/routes/cadastro.tsx` | — |
| `/categoria/$slug` | `src/routes/categoria.$slug.tsx` | productService |
| `/como-comprar` | `src/routes/como-comprar.tsx` | infoService |
| `/como-vender` | `src/routes/como-vender.tsx` | infoService |
| `/contato` | `src/routes/contato.tsx` | analyticsService, infoService |
| `/itens-proibidos` | `src/routes/itens-proibidos.tsx` | analyticsService, infoService |
| `/lit-points` | `src/routes/lit-points.tsx` | litPointsService |
| `/login` | `src/routes/login.tsx` | — |
| `/loja/$slug` | `src/routes/loja.$slug.tsx` | sellerService |
| `/politica-de-reembolso` | `src/routes/politica-de-reembolso.tsx` | analyticsService, infoService |
| `/privacidade` | `src/routes/privacidade.tsx` | analyticsService, infoService |
| `/produto/$id` | `src/routes/produto.$id.tsx` | productService, reviewService |
| `/recuperar-senha` | `src/routes/recuperar-senha.tsx` | analyticsService, transactionalEmailService |
| `/redefinir-senha` | `src/routes/redefinir-senha.tsx` | — |
| `/regras-da-plataforma` | `src/routes/regras-da-plataforma.tsx` | analyticsService, infoService |
| `/seguranca` | `src/routes/seguranca.tsx` | analyticsService, infoService |
| `/taxas` | `src/routes/taxas.tsx` | platformEconomicsService, sellerLevelService |
| `/termos` | `src/routes/termos.tsx` | analyticsService, infoService |
| `/verificacao-login` | `src/routes/verificacao-login.tsx` | — |
| `/verificar-email` | `src/routes/verificar-email.tsx` | analyticsService |

### 4.2 Conta/comprador

| Rota | Arquivo | Services diretamente usados |
|---|---|---|
| `/carrinho` | `src/routes/carrinho.tsx` | — |
| `/carteira` | `src/routes/carteira.tsx` | accountService, affiliateService |
| `/checkout` | `src/routes/checkout.tsx` | analyticsService, cartService, checkoutService, paymentService |
| `/favoritos` | `src/routes/favoritos.tsx` | accountService, productService |
| `/mensagens` | `src/routes/mensagens.tsx` | messageService |
| `/mensagens/$id` | `src/routes/mensagens.$id.tsx` | messageService, orderService, orderSupportService |
| `/notificacoes` | `src/routes/notificacoes.tsx` | analyticsService |
| `/pagamento/$id` | `src/routes/pagamento.$id.tsx` | paymentService |
| `/pedidos` | `src/routes/pedidos.tsx` | accountService |
| `/pedidos/$id` | `src/routes/pedidos.$id.tsx` | analyticsService, orderService |
| `/perfil/` | `src/routes/perfil.index.tsx` | accountService, productService |
| `/perfil/preferencias` | `src/routes/perfil.preferencias.tsx` | transactionalEmailService |
| `/perfil/verificacao` | `src/routes/perfil.verificacao.tsx` | accountService, verificationService |

### 4.3 Vendedor

| Rota | Arquivo | Services diretamente usados |
|---|---|---|
| `/vendedor` | `src/routes/vendedor.tsx` | — |
| `/vendedor/` | `src/routes/vendedor.index.tsx` | sellerDashboardService |
| `/vendedor/anuncios` | `src/routes/vendedor.anuncios.tsx` | — |
| `/vendedor/anuncios/` | `src/routes/vendedor.anuncios.index.tsx` | sellerDashboardService |
| `/vendedor/anuncios/novo` | `src/routes/vendedor.anuncios.novo.tsx` | listingDraftService |
| `/vendedor/avaliacoes` | `src/routes/vendedor.avaliacoes.tsx` | sellerDashboardService |
| `/vendedor/equipe` | `src/routes/vendedor.equipe.tsx` | sellerTeamService |
| `/vendedor/financeiro` | `src/routes/vendedor.financeiro.tsx` | sellerDashboardService |
| `/vendedor/vendas` | `src/routes/vendedor.vendas.tsx` | sellerDashboardService |
| `/vendedor/vendas/$id` | `src/routes/vendedor.vendas.$id.tsx` | sellerSaleService |

### 4.4 Admin

| Rota | Arquivo | Services diretamente usados |
|---|---|---|
| `/admin` | `src/routes/admin.tsx` | — |
| `/admin/` | `src/routes/admin.index.tsx` | adminService |
| `/admin/anuncios` | `src/routes/admin.anuncios.tsx` | adminService |
| `/admin/auditoria` | `src/routes/admin.auditoria.tsx` | adminAdvancedService |
| `/admin/catalogo` | `src/routes/admin.catalogo.tsx` | adminAdvancedService |
| `/admin/configuracoes` | `src/routes/admin.configuracoes.tsx` | adminAdvancedService |
| `/admin/conteudo` | `src/routes/admin.conteudo.tsx` | adminAdvancedService, transactionalEmailService |
| `/admin/denuncias` | `src/routes/admin.denuncias.tsx` | analyticsService, reportService |
| `/admin/disputas` | `src/routes/admin.disputas.tsx` | adminService |
| `/admin/financeiro` | `src/routes/admin.financeiro.tsx` | adminAdvancedService |
| `/admin/pedidos` | `src/routes/admin.pedidos.tsx` | adminService |
| `/admin/permissoes` | `src/routes/admin.permissoes.tsx` | adminAdvancedService |
| `/admin/relatorios` | `src/routes/admin.relatorios.tsx` | adminAdvancedService |
| `/admin/transacoes` | `src/routes/admin.transacoes.tsx` | adminService |
| `/admin/usuarios` | `src/routes/admin.usuarios.tsx` | adminService |
| `/admin/vendedores` | `src/routes/admin.vendedores.tsx` | adminService |
| `/admin/verificacoes` | `src/routes/admin.verificacoes.tsx` | adminAdvancedService |

### 4.5 Infra/layout

| Rota | Arquivo | Services diretamente usados |
|---|---|---|
| `(raiz interna)` | `src/routes/__root.tsx` | — |

## 5. Providers globais

| Provider | Estado atual | Substituição futura |
|---|---|---|
| `AuthProvider` | sessão e papel ativo somente em memória | cliente de autenticação da API, sessão segura e dispositivos |
| `CartProvider` | carrinho em memória | API/persistência ou carrinho anônimo com merge seguro |
| `NotificationProvider` | notificações em memória | API + WebSocket + persistência |

A alternância comprador/vendedor é apenas contexto de UI. O back-end deve reconhecer uma única conta com capacidades e perfil de vendedor, sem confiar em `activeRole`.

## 6. Matriz de services mockados para módulos reais

| Service atual | Métodos públicos encontrados | Destino no back-end |
|---|---|---|
| `accountService.ts` | `getAccountSummary`, `getRecentOrders`, `getRecentFavorites`, `getRecentMessages`, `getWalletSummary`, `getAccountNotifications` | users, perfil, carteira e resumo da conta |
| `adminAdvancedService.ts` | `getCategories`, `getSubcategories`, `getPermissions`, `getRoles`, `getKycQueue`, `getFees`, `getPaymentMethods`, `getLitPointsConfig`, `getSellerLevelConfigs`, `getPlans`, `getFeatureFlags`, `getContentPages`, `getReportMetrics`, `getTopCategoriesReport`, `getTopSellersReport`, `getAuditLog` | admin, configurações, RBAC, KYC e economia |
| `adminService.ts` | `getAdminDashboard`, `getAdminUsers`, `getAdminSellers`, `getAdminListings`, `getAdminOrders`, `getAdminTransactions`, `getAdminDisputes`, `getAdminReports`, `getAdminNotifications`, `getAdminAuditLogs` | consultas e dashboards administrativos |
| `affiliateService.ts` | `getAffiliateProfile`, `getAffiliateLink`, `getAffiliateStats`, `getAffiliateConversions`, `getAffiliateCommissions`, `getAffiliateCommissionSummary`, `getAffiliateCampaigns`, `getAffiliateMaterials`, `getAffiliateRules`, `getAffiliateFaq`, `getAffiliatePayoutPreview`, `simulateCopyAffiliateLink`, `simulateGenerateAffiliateCode`, `simulateRequestCommissionPayout` | afiliados e comissões |
| `analyticsService.ts` | funções nomeadas/exports auxiliares | eventos de produto e observabilidade |
| `authMock.ts` | `getSession`, `login`, `register`, `requestPasswordReset`, `logout` | autenticação, sessão e dispositivos |
| `cartService.ts` | funções nomeadas/exports auxiliares | carrinho, cupom e disponibilidade |
| `checkoutService.ts` | funções nomeadas/exports auxiliares | checkout e criação da compra principal |
| `infoService.ts` | `getHelpCategories`, `getHelpFaq`, `getBuyingSteps`, `getSellingSteps`, `getSafetyRules`, `getPlatformRules`, `getProhibitedItems`, `getRefundPolicy`, `getContactOptions`, `getLegalNotice`, `getTermsSections`, `getPrivacySections`, `simulateSubmitContactForm` | conteúdo institucional, regras e jurídico |
| `listingDraftService.ts` | `getListingModels`, `getProductTypes`, `getCategories`, `getSubcategoriesByCategory`, `getAttributesForSubcategory`, `getPromotionTiers`, `getSellerPlans`, `simulateSubmitListingDraft` | categorias, anúncios, variações, planos e rascunhos |
| `litPointsService.ts` | `getLitPointsBalance`, `getLitPointsHistory`, `getLitPointsRules`, `getLitPointsUsageRules`, `getLitPointsTierBenefits`, `getLitPointsFaq`, `getLitPointsEarningPreview`, `simulateRedeemPoints`, `simulateEarnPoints` | LIT Points e lotes de expiração |
| `messageService.ts` | `getConversations`, `getConversationById`, `getConversationMessages`, `getConversationContext`, `getConversationByOrderId`, `getOrderConversation`, `getOrderConversationMessages`, `getSellerSaleConversation`, `getAutomaticSellerMessage`, `simulateCreateOrderConversation`, `simulateSendOrderMessage`, `simulateSendMessage`, `getCurrentUser` | conversas e mensagens |
| `notificationService.ts` | `getNotifications`, `getNotificationsByRole`, `getRecentNotifications`, `getNotificationById`, `getUnreadCount`, `getNotificationFilters`, `getNotificationStats`, `simulateMarkAsRead`, `simulateMarkAllAsRead`, `simulateArchiveNotification`, `__resetForTests` | notificações internas |
| `orderService.ts` | `getBuyerOrders`, `getOrderById`, `getOrderTimeline`, `getOrderDelivery`, `getOrderDispute`, `getOrderReview`, `simulateConfirmDelivery`, `simulateOpenDispute`, `simulateSubmitReview`, `getOrderConversation`, `getOrderDeliveryStatus`, `getOrderMediation`, `getOrderEvidence`, `simulateReportDeliveryProblem`, `simulateOpenMediation` | pedidos, entrega, avaliação e intervenção |
| `orderSupportService.ts` | funções nomeadas/exports auxiliares | prazos, mensagens automáticas e mediação |
| `paymentService.ts` | funções nomeadas/exports auxiliares | pagamentos, métodos, adicional do comprador e intents |
| `platformEconomicsService.ts` | `getPromotionTiers`, `getLitMaxBenefits`, `getPaymentMethodFees`, `getPayoutRules`, `getDisclaimer`, `getTaxasFaq` | tarifas, planos e configurações econômicas |
| `productService.ts` | `list`, `featured`, `popular`, `recent`, `byCategory`, `byId`, `related` | catálogo e anúncios públicos |
| `questionService.ts` | `getQuestionsByProductId`, `simulateAskQuestion`, `sanitizeQuestionText` | perguntas públicas de anúncio |
| `reportService.ts` | `getReportTargetTypes`, `getReportReasons`, `getReportSeverityOptions`, `getReportGuidelines`, `getUserReports`, `getReportById`, `getReportsForAdmin`, `simulateSubmitReport`, `getTargetTypeLabel` | denúncias e moderação |
| `reviewService.ts` | `byProduct` | avaliações |
| `searchService.ts` | `searchProducts`, `getPopularSearches`, `getSearchSuggestions`, `getSearchFilters`, `getSearchStats` | busca e filtros |
| `sellerDashboardService.ts` | `getCurrentSeller`, `getSellerDashboardSummary`, `getSellerListings`, `getSellerRecentSales`, `getSellerFinancialSummary`, `getSellerReviews`, `getSellerNotifications`, `createListingDraft` | dashboard do vendedor |
| `sellerLevelService.ts` | `getSellerLevels`, `getSellerLevelByName`, `getSellerLevelBySellerId`, `getSellerLevelProgress`, `getSellerLevelBenefits`, `getSellerLevelRules`, `getSellerLevelFaq` | reputação e níveis do vendedor |
| `sellerSaleService.ts` | `getSellerSales`, `getSellerSaleById`, `getSellerSaleDetail`, `getSellerSaleTimeline`, `getSellerSaleDelivery`, `getSellerSaleFinancialSummary`, `getSellerSaleConversation`, `getSellerSaleMediation`, `getSellerSaleEvidence`, `simulateMarkAsDelivered`, `simulateSendDeliveryInstructions`, `simulateSubmitSellerResponse`, `simulateSubmitSellerEvidence` | vendas do vendedor e entrega |
| `sellerService.ts` | `list`, `getSellerBySlug`, `getSellerById`, `getSellerProducts`, `getSellerReviews` | loja pública e vendedor |
| `sellerTeamService.ts` | `getTeamMembers`, `getTeamRoles`, `getTeamPermissions`, `getPendingInvites`, `getTeamActivity`, `simulateInviteMember`, `simulateUpdateMemberRole`, `simulateRemoveMember`, `simulateCancelInvite` | equipe da loja e permissões |
| `transactionalEmailService.ts` | `getTransactionalEmailEvents`, `getEmailTemplates`, `getUserCommunicationPreferences`, `getEmailHistory`, `simulateSendTransactionalEmail`, `simulateResendEmail`, `simulateUpdateCommunicationPreferences`, `getSecurityEmailEvents`, `getOrderEmailEvents`, `getSellerEmailEvents`, `getAdminEmailEvents`, `commonTemplateVariables` | e-mails e preferências de comunicação |
| `verificationService.ts` | `getVerificationStatus`, `getVerificationSteps`, `getAcceptedDocuments`, `getRequirements`, `getVerificationTimeline`, `simulateSendSmsCode`, `simulateVerifySmsCode`, `simulateSubmitDocument`, `simulateSubmitSelfie`, `simulateSubmitVerification`, `getSellerVerificationBadge` | verificação de identidade/KYC |

## 7. Domínios e entidades exigidos

A modelagem final deve cobrir, no mínimo:

- identidade: User, Profile, PublicProfile, Session, TrustedDevice, TwoFactorMethod, IdentityVerification;
- vendedor: SellerProfile, Store, StoreMember, StoreRole, Verification, SellerLevel;
- catálogo: Category, CategoryField, Listing, ListingVariation, ListingMedia, InventoryUnit, DeliverySecret, ListingPlanVersion, LitMaxEnrollment;
- compra: Cart, CartItem, Checkout, Purchase, Order por vendedor, OrderItem, OrderSnapshot;
- pagamento: Payment, PaymentAttempt, PaymentWebhook, Refund, Chargeback;
- entrega: Delivery, DeliveryVersion, SecretAccessEvent, DownloadEvent;
- comunicação: Conversation, Participant, Message, Attachment, ModerationDetection;
- intervenção: Dispute, Evidence, Decision, Appeal;
- financeiro: Wallet, LedgerAccount, LedgerEntry, BalanceProjection, Payout, PayoutAttempt;
- recompensas: LitPointsWallet, LitPointsLot, LitPointsEntry;
- reputação: Review, SellerMetric, RiskSignal;
- operação: Notification, Preference, EmailDelivery, Report, SupportTicket, AdminAction, AuditEvent, SystemSettingVersion;
- growth futuro: Affiliate, Attribution, Commission, Campaign;
- equipe futura: StoreMember e permissões granulares.

## 8. Máquinas de estado

### 8.1 Pagamento

`pending → processing → approved` ou `rejected / expired / cancelled`, sempre por evento verificado do gateway. `approved` deve ser idempotente.

### 8.2 Compra e subpedido

`pending_payment → paid → awaiting_seller_delivery → delivered_by_seller → awaiting_buyer_confirmation → completed`. Caminhos laterais: `cancelled`, `disputed`, `refunded` e reembolso parcial por lançamentos.

O término financeiro não deve ser confundido com confirmação de entrega. Cada subpedido armazena `release_deadline`, regra da categoria e eventual deadline acelerado.

### 8.3 Intervenção

`opened → awaiting_evidence/response → under_review → resolved_buyer | resolved_seller | partial | closed`, com um recurso opcional em 48 horas por outro moderador.

### 8.4 KYC

`not_started → in_progress → pending_review → approved | rejected | needs_more_info`. Aprovação inicia espera de três dias para primeiro saque do vendedor.

### 8.5 Anúncio

`draft → in_review → active → paused | rejected | archived`. O histórico não é apagado quando existem vendas.

### 8.6 Saque

`requested → risk_review → processing → paid | failed | rejected | cancelled`. Falha devolve valor por lançamento compensatório.

## 9. Papéis e permissões

- usuário comum: compra e pode ativar venda;
- proprietário da loja;
- equipe futura: gerente, catálogo, vendas/atendimento, entrega e financeiro;
- administração: superadmin, operacional, suporte, moderador, financeiro, risco e conteúdo;
- toda permissão é validada na API;
- `AdminGate`, `isAdmin` e `activeRole` são apenas demonstrações visuais;
- ações financeiras altas exigem 2FA e/ou segunda aprovação;
- acesso a chat, documento e dados financeiros precisa de justificativa e auditoria.

## 10. Conflitos resolvidos pelo Documento Mestre

| Tema | Encontrado no repositório | Regra canônica | Tratamento |
|---|---|---|---|
| Arquitetura | Supabase Auth, RLS, Storage e Edge Functions são assumidos em vários Markdown. | API NestJS própria, PostgreSQL padrão e adaptadores; front nunca acessa banco. | Ignorar a escolha Supabase como regra. Conceitos de menor privilégio e segurança continuam úteis. |
| Planos de anúncio | Mocks mostram 10/12/15%, 4/6/9% e outros valores. | Prata 9,99%; Ouro 11,99%; Diamante 12,99%. | Percentuais do Documento Mestre são os oficiais iniciais. |
| Nível do vendedor | Bronze–Elite reduz tarifa e libera em 6–72 horas. | Nível é reputação/risco; tarifa vem do plano do anúncio e prazo vem da categoria. | Remover tarifa/prazo do cálculo de nível. |
| LIT Points — ganho | Mocks usam 4 pontos/R$, pontos por avaliação e multiplicador de nível. | Comprador: R$1 = 1 ponto; vendedor LIT MAX: 50% dos pontos convencionais com avaliação positiva. | Reescrever cálculo no back; UI mock não é fonte. |
| LIT Points — uso | Mocks usam R$0,02 ou R$0,05 por ponto e até 20% do pedido. | 100 pontos = R$1; mínimo 1.000; compra precisa ser 100% em pontos. | Não permitir pagamento parcial com pontos. |
| LIT Points — validade | Mock administrativo usa 365 dias. | Seis meses a partir da liberação; consumir lote que expira primeiro. | Usar lotes com expiração. |
| Proteção/plano do comprador | Mock cobra +15% e promete três meses de cobertura. | Benefícios e preço devem ser extraídos/parametrizados; não altera silenciosamente a garantia financeira definida. | Tratar como produto adicional versionado e configurável. |
| Prazo de mediação | Mock: 15/30/45 dias e extensão com Proteção LIT. | Liberação inicial por categoria: 4 ou 7 dias; intervenção protegida até a data de liberação; reclamação posterior até 30 dias sem garantia automática. | Substituir janelas antigas. |
| Marco do prazo | Docs antigas ligam liberação à confirmação do comprador ou ao nível. | Contagem conforme regra da categoria após pagamento aprovado; data exata no chat; confirmação + avaliação positiva pode reduzir pela metade. | Implementar snapshot por subpedido. |
| Confirmação de entrega | Contrato antigo diz que confirmar entrega libera escrow. | Confirmação não libera imediatamente; pode acionar liberação acelerada com avaliação positiva. | Novo endpoint deve registrar confirmação e recalcular deadline. |
| Reembolso | Definições antigas convertem ou misturam saldo. | Cartão volta ao cartão; Pix volta à origem; saldo volta ao saldo; pontos voltam em pontos. | Gateway/ledger devem refletir origem. |
| Disputa tardia | Regra anterior garantia pagamento do caixa do LIT Buy. | Sem garantia automática após liberação; dívida do vendedor pode ser recuperada e repassada ao comprador. | Não antecipar caixa automaticamente. |
| KYC | Docs antigas deixam KYC condicional por valor/categoria. | Vendedor pode vender, mas saque exige verificação completa e espera de três dias; comprador sacando reembolso também verifica. | Criar trava de payout. |
| Meios de pagamento | Boleto aparece ativo e cripto futuro em services. | Lançamento: Pix, cartão, saldo e LIT Points; boleto preparado/desativado; cripto fora do lançamento. | Controlar por feature flag/configuração. |
| Modelo de pedido | Contratos antigos tratam `/orders/:id` como unidade simples. | Checkout multi-vendedor cria compra principal e subpedido independente por vendedor. | API e banco precisam separar Purchase/Order. |
| Chat | Front possui pré-compra, pedido e suporte. | Pré-compra pode existir, mas entrega/evidência/intervenção oficial só no chat do subpedido após pagamento. | Preservar tipos, reforçar finalidade. |
| Equipe e afiliados | Telas e mocks estão ativos visualmente. | Back-end preparado, funcionalidades inicialmente desativadas por configuração. | Implementar depois do núcleo e manter feature flag. |

## 11. Documentação antiga: manter sem apagar

Nenhum arquivo precisa ser removido. A regra prática será:

- Documento Mestre V2: fonte canônica;
- esta auditoria: mapa do estado real e dos conflitos;
- mapas de rotas/services/providers: inventário útil;
- documentos antigos de Supabase, banco, API e roadmap: planejamento histórico;
- mocks: contrato visual e amostra de campos, nunca fonte de números oficiais;
- qualquer conflito é resolvido pelo Mestre V2.

Essa abordagem é suficiente desde que todos os prompts citem explicitamente os dois arquivos canônicos. Não se deve presumir que o Codex priorizará espontaneamente um Markdown apenas porque ele está na raiz.

## 12. Riscos

| Severidade | Área | Risco | Controle exigido |
|---|---|---|---|
| Crítico | Financeiro/ledger | Duplicação de webhook, saldo incorreto, double spend, reembolso e saque concorrentes. | Transações, idempotência, ledger imutável, outbox, testes de concorrência e revisão sênior. |
| Crítico | Autorização | AdminGate e activeRole são apenas visuais. | RBAC/ABAC server-side, testes de permissão e menor privilégio. |
| Crítico | Dados de entrega | Credenciais e códigos digitais são altamente sensíveis. | Criptografia, storage privado, versionamento, auditoria e links temporários. |
| Crítico | KYC e saque | Documento/selfie e chave Pix envolvem dados sensíveis e fraude. | Provedor especializado, minimização de dados e revisão jurídica/segurança. |
| Alto | Regras conflitantes | Mocks e 35 Markdown possuem números antigos. | Master V2 obrigatório em todos os prompts; audit file como mapa. |
| Alto | Ausência de testes | Não há arquivos de teste nem script `test`. | Backend nasce com unit/integration/e2e e CI desde a fundação. |
| Alto | Multi-vendedor | Carrinho atual não modela compra principal/subpedidos no domínio real. | Criar Purchase + Order por vendedor e snapshots. |
| Alto | Chat/moderação | Detecção no front é contornável. | Moderação e bloqueio no servidor; preservar original para auditoria. |
| Alto | Produto digital e reembolso | É difícil provar uso/revelação de segredo. | Eventos de revelação, download, transferência e versões de entrega. |
| Médio | Escalabilidade | Chat, e-mail e jobs não devem bloquear requests. | Redis/BullMQ, workers e observabilidade. |
| Médio | TanStack Start beta/Nitro beta | Front usa versões novas e SSR customizado. | Não acoplar domínio financeiro ao runtime do front; API separada. |
| Médio | Documentos jurídicos | Textos são rascunhos demonstrativos. | Revisão jurídica antes da produção. |

## 13. Roadmap recomendado para prompts do Codex

| Sprint | Foco | Entrega |
|---|---|---|
| Sprint 0 | Preparação documental e validação | Adicionar Mestre V2 e esta auditoria à raiz; Codex executa build/lint/typecheck e confirma inventário sem alterar funcionalidade. |
| Sprint 1 | Fundação da API | Criar `backend/` NestJS, Docker, PostgreSQL, Prisma, Redis, config, health, erros, logs, OpenAPI e testes. |
| Sprint 2 | Identidade e autenticação | Cadastro, verificação de e-mail/telefone, login, recuperação, sessões, dispositivos, 2FA e RBAC base. |
| Sprint 3 | Usuários, perfis e vendedor | Perfil, nickname, loja, ativação de vendedor, preferências e estrutura de KYC. |
| Sprint 4 | Categorias e configurações | Categorias, subcategorias, campos dinâmicos, prazos, planos e versionamento de configurações. |
| Sprint 5 | Anúncios e estoque | Rascunhos, publicação, variações, estoque, mídia, duplicidade, moderação e snapshots. |
| Sprint 6 | Carrinho e checkout | Carrinho multi-vendedor, cupons, reserva de estoque, Purchase e subpedidos. |
| Sprint 7 | Pedidos e entrega | Máquinas de estado, área de entrega segura, deadlines, mensagens automáticas e confirmação. |
| Sprint 8 | Chat e notificações | WebSocket, conversas, anexos, anti-contato externo, notificações e e-mail por filas. |
| Sprint 9 | Avaliações e reputação | Avaliações comprador/vendedor, liberação acelerada e métricas. |
| Sprint 10 | Intervenção e moderação | Evidências, decisões, recurso, bloqueio de valores, denúncias e auditoria. |
| Sprint 11 | LIT Points | Lotes, liberação, expiração, pagamento integral em pontos, estorno e antifraude. |
| Sprint 12 | Ledger e carteira sandbox | Contas contábeis, lançamentos, saldos, dívida, ajustes e reconciliação simulada. |
| Sprint 13 | Gateway sandbox | Adaptador do provedor escolhido, Pix/cartão, webhooks, reembolsos e chargeback sandbox. |
| Sprint 14 | Saques/KYC sandbox | Payout Pix, travas, titularidade, revisão de risco e espera de três dias. |
| Sprint 15 | Admin real | Permissões, configurações, dupla aprovação, relatórios, logs e moderação. |
| Sprint 16 | Integração progressiva do front | Substituir mocks por API módulo a módulo, sem big bang. |
| Sprint 17 | Funcionalidades desativadas | Afiliados e equipe da loja atrás de feature flags. |
| Sprint 18 | Hardening e handoff profissional | Segurança, carga, LGPD, infraestrutura, observabilidade e checklist de produção. |

## 14. Próxima tarefa segura do Codex

A primeira tarefa deve ser somente de validação e preparação. Ela deve:

1. ler o Mestre V2 e esta auditoria;
2. confirmar a stack e os 65 arquivos de rota;
3. instalar dependências;
4. executar lint, typecheck e build;
5. registrar erros preexistentes;
6. confirmar que não há back-end de domínio;
7. não implementar nada;
8. não alterar mocks nem documentos antigos;
9. criar apenas um relatório final da validação ou responder no próprio resultado do Codex;
10. aguardar aprovação antes da Sprint 1.

## 15. Critério para começar a codificar

Após o Codex confirmar instalação, typecheck e build, a Sprint 1 pode começar sem novo questionário geral. Dúvidas futuras devem ser pontuais, demonstrar arquivo e impacto, e somente interromper a parte afetada.

## 16. Veredito

O repositório e o Documento Mestre fornecem material suficiente para iniciar o trabalho no Codex de maneira controlada. A base visual é reaproveitável, os domínios estão amplamente representados e as contradições relevantes foram identificadas. O próximo passo é adicionar os dois arquivos canônicos à raiz e executar a validação independente do Codex antes da fundação da API.

