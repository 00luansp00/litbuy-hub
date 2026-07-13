# LIT Buy — Project Rules

Regras obrigatórias para qualquer desenvolvedor(a) ou agente que contribuir com o projeto LIT Buy. O objetivo é preservar a qualidade arquitetural e a identidade visual do marketplace ao longo de dezenas de sprints.

## 1. Princípios gerais

- **Evoluir, nunca recriar.** O projeto continua entre sprints; nunca reestruture o que já funciona.
- **Reutilizar antes de criar.** Consulte `src/components/` antes de introduzir qualquer componente novo.
- **TypeScript sempre.** Nada de `any` implícito; prefira tipos em `src/types/`.
- **Escalabilidade primeiro.** Toda nova feature deve caber na arquitetura existente sem gambiarras.

## 2. Componentização

- Nunca duplique componentes. Se existir um `ProductCard`, `SectionHeader`, `AuthCard`, etc., estenda-os por props.
- Componentes de UI baixo-nível vivem em `src/components/ui/` (shadcn) — **não editar diretamente** salvo bugfix.
- Componentes reutilizáveis de domínio vivem em `src/components/common/`.
- Componentes de feature vivem em `src/components/<feature>/` (ex.: `home/`, `auth/`, `layout/`, `product/`, `seller/`).

### Convenções de rota — vendedor

- **`/vendedor`** é reservada para o **painel do vendedor** (área logada, futura sprint). Não usar para perfil público.
- **`/loja/$slug`** é o **perfil público** da loja/vendedor. Consome `sellerService`.

## 3. Identidade visual

- Utilize sempre os tokens semânticos definidos em `src/styles.css` (`bg-background`, `text-foreground`, `bg-primary`, `text-gradient`, `shadow-elegant`, `bg-hero`, `container-lit`, etc.).
- **Nunca** utilize cores hardcoded (`text-white`, `bg-[#...]`, `bg-black`) em componentes de aplicação.
- Fontes: `Sora` para títulos, `Inter` para corpo. Não introduzir novas famílias sem aprovação.
- Tema dark-first. Nunca alterar a identidade visual sem solicitação explícita do produto.

## 4. Rotas

- Rotas ficam em `src/routes/` usando `createFileRoute` do TanStack Router.
- Nunca editar `src/routeTree.gen.ts` — é gerado.
- Toda rota de placeholder deve usar `PlaceholderPage` com título e ícone dedicados.

## 5. Dados

- Dados mockados vivem em `src/data/`.
- Nenhuma feature pode importar dados diretamente de componentes; passe via props ou service.
- Chamadas simuladas passam pelos services em `src/services/`, sempre assíncronas, prontas para virarem HTTP.

## 6. Estado & Auth

- Autenticação atual é **mock em memória** (`src/services/authMock.ts` + `AuthProvider`). Zero LocalStorage, cookies, JWT ou backend.
- Novas features que dependem de sessão devem consumir `useAuth()` e nunca criar seu próprio estado paralelo.

## 7. Dados e acesso

- **Nunca** acessar mocks de `src/data/` diretamente em páginas ou componentes. Sempre consumir via `src/services/*`.
- Toda leitura/escrita de dados passa por um service assíncrono — mesmo que hoje resolva localmente.
- Novos services devem usar assinaturas compatíveis com uma futura API HTTP/Supabase (async, retornando `Promise`, aceitando parâmetros serializáveis).
- Toda nova entidade deve ser compatível com o contrato definido em `DATABASE_SCHEMA.md` e `ENTITY_RELATIONSHIP.md`.

## 8. Restrições até nova ordem

Não implementar nesta fase:

- Backend, banco de dados, APIs reais
- Supabase (client, migrations, políticas) — apenas em sprint dedicada, seguindo `SUPABASE_RLS_PLAN.md`
- Autenticação real, OAuth, providers sociais
- Pagamentos, lógica financeira, checkout real, cálculo de saldo no frontend
- Mensageria, uploads reais, notificações push
- Regras de segurança implementadas apenas no cliente — segurança é responsabilidade do backend (RLS / server functions)

Toda funcionalidade sensível (pagamentos, disputas, movimentação de carteira, admin) deve ser **planejada em documentação** antes de qualquer linha de código.

## 9. Qualidade

- Preserve acessibilidade: `aria-label`, foco visível, contraste.
- Animações discretas via `motion` (framer-motion) — nunca exageradas.
- Toda tela deve funcionar em mobile, tablet e desktop.
- Zero `console.log` em produção; use os utilitários de log/erro existentes.

## 10. Documentação

- Toda sprint que introduzir um módulo novo deve atualizar `ARCHITECTURE.md`.
- Toda nova entidade de dados deve ser refletida em `DATABASE_SCHEMA.md`, `ENTITY_RELATIONSHIP.md` e, se aplicável, `SUPABASE_RLS_PLAN.md`.
- Decisões arquiteturais relevantes devem ser registradas neste arquivo ou em ADRs futuros.


## Regras adicionais (pós-Sprint 14)

- A mesma conta pode ter papel comprador e vendedor. `activeRole` é 100% mockado em memória — nunca persistir em LocalStorage, cookies ou backend nesta fase.
- O `ImageUploader` atual é apenas visual: **nenhum upload real, nenhuma persistência, nenhum Storage**. Substituição por uploader real deve preservar a API do componente.
- Produtos com `stock <= 0` ou `status === "paused"` são considerados indisponíveis. Não podem ser adicionados ao carrinho e não podem finalizar checkout.
- Regras reais de estoque, reserva e validação de disponibilidade devem viver no backend futuramente — o mock atual serve apenas para preparar a UI.

## Painel Administrativo

- Ações administrativas reais exigem backend — não podem ocorrer no frontend.
- `AdminGate` é proteção visual apenas, não é segurança real.
- Permissões reais (RBAC), moderação, suspensão de contas, resolução de disputas e movimentações financeiras devem ser implementadas no backend.
- Nenhum dado exibido no painel deve ser persistido, exportado ou transmitido para serviços externos enquanto o backend não existir.
- Páginas em `/admin/*` devem consumir apenas `adminService`, nunca mocks diretamente.

## Regras de conta (Hotfix 18.1)

- Toda conta comum da LIT Buy é **compradora e vendedora** por padrão.
- Não existe cadastro/ativação separada de vendedor no MVP.
- `activeRole` é apenas contexto visual (`"buyer" | "seller"`) — nunca permissão.
- `/vendedor` e todas as suas subrotas exigem **apenas login** (`AuthGate`).
- `/vendedor/anuncios/novo` abre para qualquer usuário logado.
- `hasSellerProfile` é campo legado (sempre `true` no mock) e **não deve** ser usado para bloquear acesso.
- `/admin` exige login **e** `isAdmin === true` (`AdminGate`).
- No mock, `isAdmin` é ativado apenas para o email demo `admin@litbuy.com`.
- Segurança real fica para o backend (RLS + `has_role`).

## Regras de marketplace (Sprint 18.2)

Ver `MARKETPLACE_RULES.md` para a visão consolidada. Regras invioláveis para qualquer contribuição:

- **Não criar pagamento real no frontend.** Nenhuma integração com gateway parte do cliente sem backend/webhooks verificados.
- **Não criar carteira real no frontend.** Cálculo de saldo, taxa, líquido, pendente/disponível é responsabilidade do backend.
- **Não criar disputa real no frontend.** Mutações de estado de disputa só via server function autenticada; frontend apenas dispara e exibe.
- **Não criar entrega real sem backend.** Payload de entrega, evidências e signed URLs exigem servidor.
- **Não criar avaliação real sem pedido concluído.** Toda review deve estar amarrada a `order_item` de pedido `completed`.
- **Não permitir compra de produto sem `status === 'active'` e `stock > 0`.** Validação tanto no frontend (UX) quanto no backend (segurança).
- **Toda conta comum pode comprar e vender** — não existem contas dedicadas de comprador ou vendedor.
- **Admin real exige backend + `user_roles` + `has_role()` + RLS.** Hoje o gate é mock (`isAdmin` derivado do email).

Documentos relacionados: `ORDER_LIFECYCLE.md`, `DIGITAL_DELIVERY_FLOW.md`, `DISPUTE_FLOW.md`, `WALLET_AND_ESCROW_RULES.md`, `LISTING_STATUS_RULES.md`, `REVIEW_RULES.md`, `MESSAGING_RULES.md`.

## Busca Global (Sprint 18.3)

- Rota `/buscar` recebe query string `?q=termo` (validado com zod via `validateSearch`).
- `searchService` (`src/services/searchService.ts`) centraliza toda a lógica de busca mockada: filtra por título, categoria, vendedor e descrição.
- Métodos: `searchProducts`, `getPopularSearches`, `getSearchSuggestions`, `getSearchFilters`, `getSearchStats`.
- Componentes visuais em `src/components/search/`: `SearchPageHeader`, `SearchFiltersPanel`, `SearchSortBar`, `PopularSearches`, `SearchSuggestions`.
- Reutiliza `ProductGrid`, `ProductCard`, `EmptyState`, `CategoriesGrid`, `SectionHeader`.
- Filtros e ordenação são aplicados em memória (mock). Nenhum backend/API/indexação real foi implementado.
- Produtos indisponíveis continuam bloqueados pelo `ProductCard` (regra de `getUnavailabilityReason` preservada).
- Navbar (desktop e mobile) submete via `<form>` para `/buscar?q=termo`.
- Substituição futura: `searchService` deve ser reescrito para consumir API/backend (Postgres FTS, Algolia, Meilisearch) mantendo a mesma assinatura de contrato.
- Páginas NÃO devem filtrar `@/data/*` diretamente para busca — sempre passar por `searchService`.

## Pós-compra (Sprint 18.4)

- Novo `orderService` (`src/services/orderService.ts`) fornece pedidos mockados, timeline, entrega digital, disputa e avaliação.
- Nova rota `/pedidos/$id` protegida por `AuthGate`, com Breadcrumb, cabeçalho, timeline, itens, card de entrega digital, disputa e avaliação.
- `RecentOrdersCard` agora linka o botão "Ver detalhes" para `/pedidos/$id`.
- Componentes novos em `src/components/orders/`: `OrderHeader`, `OrderStatusBadge`, `OrderTimeline`, `OrderItemsList`, `DigitalDeliveryCard`, `OrderSecurityNotice`, `OrderActionsCard`, `OrderDisputeCard`, `OrderReviewCard`.
- Entrega digital: dados sensíveis ficam mascarados (`••••`) com blur; botão "Revelar" apenas mostra toast informando que dados reais exigem backend seguro. Nada é armazenado.
- Disputa: modal com motivo + descrição; envio é apenas `toast` via `orderService.simulateOpenDispute` — nenhuma persistência.
- Avaliação: só liberada quando `status === "completed"`; envio via `orderService.simulateSubmitReview` mostra toast — nenhuma nota é salva.
- Ação "Confirmar recebimento" é mockada e sinaliza que em produção o pagamento seria liberado ao vendedor.
- `/vendedor/vendas/$id` NÃO foi criada nesta sprint para manter baixo risco; a visão do vendedor sobre o pedido permanece como toast/documentação.
- Limitações: nenhum backend, nenhuma persistência, nenhum dado sensível real, nenhum pagamento real, nenhuma disputa real acionada.

## Mensagens (Sprint 18.5)

- Chat real exige backend dedicado (Supabase Realtime ou WebSocket) — não implementado no MVP.
- Todas as conversas são mockadas via `messageService`. Rotas NUNCA devem importar `@/data/*` para mensagens.
- Mensagens vinculadas a pedido (`context.type === "order_related"`) devem ser preservadas no backend futuro e ficarão associadas ao pedido para efeito de disputa.
- Mensagens podem ser usadas como evidência em disputas — o aviso `MessageSecurityNotice` documenta essa regra na UI.
- Envio de mensagem no MVP é apenas visual (`simulateSendMessage`) e vive somente em estado do componente; nada é persistido em LocalStorage, Cookies ou backend.
- Integrações de "Enviar mensagem" (loja, produto, pedido) devem apontar para `/mensagens` ou `/mensagens/$id` mockado. Nunca simular envio real de fora do fluxo `/mensagens`.
- Ao substituir por backend, preservar as assinaturas de `messageService`: `getConversations`, `getConversationById`, `getConversationMessages`, `getConversationContext`, `simulateSendMessage` (que passa a ser `sendMessage` real).

## Sprint 18.7 — Anúncio Avançado (mockado)

- Anúncios podem ser **Normal**, **Dinâmico** ou **Serviço**.
- Entrega pode ser **Manual** ou **Automática**; entrega automática real exige backend seguro.
- **Cofre Seguro** de entrega é apenas visual; um cofre real não pode viver no frontend.
- Credenciais reais (senhas, códigos, tokens) nunca devem ser armazenadas em client-side.
- **LIT-MAX** é o plano premium próprio da LIT Buy; nenhuma referência a marcas externas.
- Planos **Prata / Ouro / Diamante** são mockados nesta fase; sem cobrança real.
- Campos de conta (procedência, recuperação, verificação) exigirão validação e política de segurança futura.
- Atributos dinâmicos por jogo/subcategoria devem ser configuráveis futuramente pelo admin/backend.
- Nenhum dado do wizard é persistido; nem LocalStorage, nem Cookies.

## Sprint 18.8 — Produto avançado no lado comprador

- Produto Dinâmico exige seleção de variação antes de compra/checkout.
- Produto Serviço "sob orçamento" não vai direto ao carrinho: encaminha para /mensagens.
- Produto Moeda Virtual usa cotação visual demonstrativa; lógica real será backend.
- Perguntas públicas do anúncio são distintas das mensagens privadas.
- Contato externo (WhatsApp, Discord, Telegram, links, e-mails, números longos)
  é desencorajado e censurado visualmente em perguntas e mensagens.
- MiniCartModal é apenas uma camada de UX; **não substitui /carrinho nem /checkout**.
- Nada é persistido: sem LocalStorage, sem Cookies, sem backend.
- Checkout continua **mockado**. Pix, boleto e cartão são demonstração.
- Nunca coletar cartão real no frontend; nunca gerar Pix/boleto real.
- Proteção LIT (+15%) é visual; regras finais dependem de backend/antifraude.
- LIT Points no checkout são visuais; nenhum ponto real é debitado.
- Saldo LIT no checkout é mock; carteira real exige backend.
- Analytics é ganchado mas nunca envia dados reais.

## Sprint 18.10 — LIT Points, Tarifas, Prazos e Níveis de Vendedor

- Programa LIT Points é próprio da LIT Buy. Não é dinheiro, não é saldo financeiro, não pode ser sacado.
- Rotas públicas `/lit-points` e `/taxas` explicam programa, tarifas, prazos e níveis de vendedor.
- Níveis Bronze/Prata/Ouro/Diamante/Elite são visuais e mockados.
- Taxas e prazos exibidos são demonstrativos. Cálculo real, cobrança, split, escrow, saques e assinatura LIT-MAX exigem backend.
- Saldo LIT é separado de LIT Points. Saldo pendente/disponível/bloqueado é apenas visual.
- Services: `litPointsService`, `sellerLevelService`, `platformEconomicsService` — todos mockados, sem persistência.
- Integrações leves em `/carteira`, `/vendedor`, `/vendedor/financeiro`, `/loja/$slug` e `/produto/$id`.
- Footer aponta para `/lit-points` e `/taxas`.

## Sprint 18.11 — Verificação e Equipe
- Verificação/KYC é **mockada**. Nenhum documento, selfie ou dado sensível real deve ser inserido.
- O selo "Vendedor Verificado" é apenas visual e vem de `verificationService.getSellerVerificationBadge`.
- Equipe do vendedor é visual/mockada. Cargos e permissões existem só para demonstração.
- Nenhum componente pode acessar mocks de verificação/equipe diretamente — sempre via `verificationService` e `sellerTeamService`.
- Verificação real exigirá backend seguro, storage protegido, fornecedor de KYC e conformidade LGPD.
- Permissões reais exigirão RBAC completo e audit log; convites reais exigirão e-mail com token expirável.

## Sprint 18.12 — Admin Avançado
- Todas as ações do admin (aprovar, alternar flag, editar taxa, publicar conteúdo, decidir KYC) são **mockadas**. Toasts e estado local apenas.
- Nenhuma rota admin deve acessar mocks diretamente — sempre via `adminAdvancedService` ou `adminService`.
- Categorias/subcategorias, taxas, planos, LIT Points, feature flags e conteúdo institucional visíveis no admin devem ser controlados por backend em produção.
- Audit log real é obrigatório para ações sensíveis (financeiro, permissão, KYC, remoção).
- `AdminGate` é proteção **visual** — RBAC real deve viver no backend.

## Sprint 18.13 — Detalhe da Venda, Chat do Pedido, Entrega e Mediação (mock)

- Pagamento aprovado (mock) formaliza a criação de uma conversa vinculada ao pedido (`order_related`), acessível em `/pedidos/$id` e em `/mensagens/$id`.
- Chat do pedido é o canal oficial para entrega, suporte e mediação. Conversa fora da plataforma reduz proteção futura.
- Entrega manual e entrega automática são exibidas de forma **visual/mockada** (nunca revelam dados reais). Cofre e criptografia reais exigem backend.
- Central de Mediação (mock) cobre motivos, provas, réplica do vendedor, timeline e trechos do chat como evidência.
- Rota `/vendedor/vendas/$id` mostra a visão do vendedor: comprador, produto, pagamento, entrega, chat, financeiro, timeline e mediação.
- Services: `sellerSaleService`, extensões em `orderService` e `messageService`; nenhum dado é persistido.
- Confirmação de recebimento, liberação de saldo, uploads reais e decisões de mediação **só podem ocorrer no backend real**.

## Sprint 18.14 — Central de Notificações (mock)

- Central visual/mockada: `notificationService` + `NotificationProvider` (`useNotifications`).
- Sino na Navbar (`NotificationBell`): dropdown no desktop, navegação para `/notificacoes` no mobile.
- Rota nova: `/notificacoes` com filtros, contagem de não lidas, marcar como lida / marcar todas / arquivar (tudo em memória).
- Notificações são geradas por papel — comprador, vendedor, admin — e cobrem pedido, pagamento, entrega, chat, mediação, vendas, KYC, denúncias, financeiro e admin.
- Notificações apontam para rotas reais quando existem (`/pedidos/$id`, `/vendedor/vendas/$id`, `/mensagens/$id`, `/admin/*`, `/lit-points`, etc.).
- **Nada é persistido**: sem LocalStorage, sem Cookies, sem backend. Push, e-mail, SMS, WebSocket e Service Worker **não** são implementados — exigem backend real, opt-in do usuário e infra de mensageria.
- Dados sensíveis nunca devem aparecer em notificações — títulos e descrições são genéricos e mascarados.

## Sprint 18.15 — Denúncias (mock)

- Denúncias são 100% mockadas nesta fase. Nenhum dado é persistido.
- **Denúncia ≠ mediação**: mediação resolve problema de entrega/produto em um pedido; denúncia sinaliza comportamento irregular (golpe, contato externo, abuso, spam, anúncio proibido).
- Toda denúncia usa `reportService` + `ReportDialog` + `ReportButton`. Nenhuma tela deve ler mocks de denúncia diretamente.
- Contato externo (WhatsApp/Discord/Telegram/telefone/e-mail) sempre deve ser reportável em mensagens e conversas.
- Denúncia real exigirá backend, moderação, RBAC, audit log e storage seguro de evidências.
- Ações admin (suspender anúncio, bloquear usuário, encaminhar mediação) são mockadas com toast — não alteram nada real.

## Sprint 18.16 — Programa de Afiliados (mock)

- Programa de afiliados é **100% visual/mockado** nesta fase.
- Comissão real exige backend, cálculo server-side e atribuição confiável.
- Tracking real exige backend, cookies com consentimento e atribuição segura.
- Saque real exige backend financeiro, KYC e integração bancária.
- Autoindicação, spam, cliques automatizados e múltiplas contas devem ser bloqueados no backend.
- Comissões não podem depender apenas do frontend — cálculo deve ser server-side.
- Nenhum dado do programa de afiliados persiste (sem LocalStorage, sem Cookies).

## Sprint 18.17 — Páginas Públicas de Confiança, Regras e Ajuda (mock)

- Rotas institucionais criadas: `/ajuda`, `/como-comprar`, `/como-vender`, `/seguranca`, `/regras-da-plataforma`, `/itens-proibidos`, `/politica-de-reembolso`, `/termos`, `/privacidade`, `/contato`.
- Todo conteúdo é **rascunho demonstrativo**. Termos e Privacidade **não são jurídicos finais** e exigem revisão profissional antes de produção.
- Todas as páginas consomem `infoService`. Nenhuma tela lê dados diretamente.
- Formulário de `/contato` é 100% mockado (`simulateSubmitContactForm` + toast). Nenhum e-mail é enviado. Nada é persistido.
- Suporte real, CMS, chat de suporte, envio de e-mail e cookies exigem backend.
- Regras públicas devem ser mantidas alinhadas com `MARKETPLACE_RULES.md`, `SECURITY_NOTES.md` e o painel admin.

## Sprint 18.18 — Chat Oficial do Pedido + Mediação Guiada
- O chat vinculado ao pedido (`OrderChatCard`) é o **canal oficial de comunicação** e suporte deste pedido na LIT Buy. Comprador e vendedor devem tratar tudo por ali; a plataforma se apoia neste histórico para mediar.
- "Reportar problema" no chat abre **mediação do pedido** (`OrderProblemDialog`), não denúncia. Mediação ≠ denúncia: mediação resolve o pedido e pode reter saldo; denúncia sinaliza comportamento irregular à moderação.
- O botão "Reportar problema" possui prazo mockado por categoria (`orderSupportService.getMediationDeadline`) que pode ser estendido com Proteção LIT. Prazo real exige backend.
- Saldo do vendedor pode ficar **retido** em mediação (visual em `/vendedor/vendas/$id`). Liberação/bloqueio real exige backend financeiro; hoje é apenas rótulo `Saldo bloqueado em mediação`.
- Mensagens automáticas do sistema, aviso de manual de instruções e aviso anti-poaching aparecem no topo do chat e são derivadas do pedido, não de backend.
- Chat externo (fora da LIT Buy) reduz proteção do usuário. Mensagens dentro da plataforma podem ser usadas como evidência em mediação.

## Sprint 18.19 — E-mails Transacionais & Preferências de Comunicação

- Envio real de e-mails transacionais é responsabilidade do backend
  (provedor: Resend, SendGrid, SES, Mailgun ou Supabase Auth) — nunca do frontend.
- O frontend apenas apresenta telas, estados, templates visuais e preferências.
- E-mails críticos de segurança (novo dispositivo, verificação, reset de senha,
  confirmação de reset) NÃO podem ser desativados completamente pelo usuário.
- Recuperação de senha real exige token seguro emitido pelo backend com expiração curta.
- Detecção real de novo dispositivo exige backend com sessões/auditoria/fingerprint.
- Templates reais precisam ser gerenciados por um sistema com versionamento,
  variáveis seguras, sanitização e preview server-side.
- Nada é persistido no frontend — sem LocalStorage, sem Cookies, sem mocks
  gravados no cliente.
