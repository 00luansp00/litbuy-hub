# ROUTES_MAP.md — LIT Buy

Todas as rotas do MVP mockado. Convenção TanStack Router
(file-based em `src/routes/`). `/admin/denuncias` é a rota oficial
para denúncias — **`/admin/reclamacoes` não existe**.

Legenda:

- **Auth**: público / usuário / vendedor / admin.
- **Gate**: componente que protege visualmente (nenhuma proteção real).
- **Service**: service principal consumido.
- **Backend futuro**: o que precisará ser criado.

## 1. Rotas públicas

| Rota                     | Finalidade              | Auth    | Gate | Service                   | Backend futuro                          |
| ------------------------ | ----------------------- | ------- | ---- | ------------------------- | --------------------------------------- |
| `/`                      | Home / landing          | público | —    | product, category         | listagem paginada + destaques + SEO SSR |
| `/buscar`                | Busca de produtos       | público | —    | searchService             | busca full-text, ranking, filtros       |
| `/login`                 | Login demo              | público | —    | authMock                  | Auth real                               |
| `/cadastro`              | Cadastro demo           | público | —    | authMock                  | Auth real + verificação e-mail          |
| `/recuperar-senha`       | Solicitar reset         | público | —    | transactionalEmailService | Token seguro + e-mail                   |
| `/redefinir-senha`       | Definir nova senha      | público | —    | transactionalEmailService | Validar token, expiração                |
| `/verificar-email`       | Confirmação de e-mail   | público | —    | transactionalEmailService | Token de verificação                    |
| `/verificacao-login`     | Alerta novo dispositivo | público | —    | transactionalEmailService | Device fingerprint + código             |
| `/categoria/$slug`       | Listagem por categoria  | público | —    | category, product         | filtros + paginação                     |
| `/produto/$id`           | Detalhe do produto      | público | —    | productService            | Produto + variações + reviews + SEO     |
| `/loja/$slug`            | Vitrine do vendedor     | público | —    | sellerService             | Perfil vendedor + produtos              |
| `/lit-points`            | Landing LIT Points      | público | —    | litPointsService          | Regras, saldo                           |
| `/taxas`                 | Taxas da plataforma     | público | —    | platformEconomicsService  | Config admin                            |
| `/afiliados`             | Programa afiliados      | público | —    | affiliateService          | Tracking, comissão                      |
| `/ajuda`                 | Central de ajuda        | público | —    | infoService               | CMS de FAQ                              |
| `/como-comprar`          | Guia comprador          | público | —    | infoService               | CMS                                     |
| `/como-vender`           | Guia vendedor           | público | —    | infoService               | CMS                                     |
| `/seguranca`             | Segurança               | público | —    | infoService               | CMS                                     |
| `/regras-da-plataforma`  | Regras                  | público | —    | infoService               | CMS + versão jurídica                   |
| `/itens-proibidos`       | Lista proibidos         | público | —    | infoService               | CMS                                     |
| `/politica-de-reembolso` | Política reembolso      | público | —    | infoService               | CMS jurídico                            |
| `/termos`                | Termos de uso           | público | —    | infoService               | Rascunho — precisa jurídico             |
| `/privacidade`           | Política LGPD           | público | —    | infoService               | Rascunho — precisa jurídico             |
| `/contato`               | Formulário contato      | público | —    | infoService               | Backend + anti-spam + e-mail            |

## 2. Rotas do usuário / comprador

| Rota                   | Finalidade               | Auth | Gate     | Service                           | Backend futuro           |
| ---------------------- | ------------------------ | ---- | -------- | --------------------------------- | ------------------------ |
| `/perfil`              | Painel do usuário        | user | AuthGate | accountService                    | Perfil real              |
| `/perfil/verificacao`  | KYC visual               | user | AuthGate | verificationService               | KYC (Idwall/Unico/Jumio) |
| `/perfil/preferencias` | Preferências comunicação | user | AuthGate | transactionalEmailService         | Persistência             |
| `/pedidos`             | Meus pedidos             | user | AuthGate | orderService                      | Listagem paginada        |
| `/pedidos/$id`         | Detalhe do pedido        | user | AuthGate | orderService, orderSupportService | Timeline + chat real     |
| `/favoritos`           | Favoritos                | user | AuthGate | productService                    | Persistência             |
| `/mensagens`           | Lista de conversas       | user | AuthGate | messageService                    | Realtime                 |
| `/mensagens/$id`       | Conversa                 | user | AuthGate | messageService                    | Realtime + moderação     |
| `/carteira`            | Saldo LIT                | user | AuthGate | accountService                    | Wallet real              |
| `/carrinho`            | Carrinho                 | user | AuthGate | cartService                       | Cart server-side         |
| `/checkout`            | Fluxo checkout           | user | AuthGate | checkoutService, paymentService   | Split, escrow, gateway   |
| `/pagamento/$id`       | Aguardar pagamento       | user | AuthGate | paymentService                    | Webhook gateway          |
| `/notificacoes`        | Central                  | user | AuthGate | notificationService               | Push + realtime          |

## 3. Rotas do vendedor

| Rota                      | Finalidade          | Auth   | Gate     | Service                            | Backend futuro            |
| ------------------------- | ------------------- | ------ | -------- | ---------------------------------- | ------------------------- |
| `/vendedor`               | Dashboard vendedor  | seller | AuthGate | sellerDashboardService             | Métricas reais            |
| `/vendedor/anuncios`      | Meus anúncios       | seller | AuthGate | sellerService, listingDraftService | CRUD + aprovação          |
| `/vendedor/anuncios/novo` | Wizard novo anúncio | seller | AuthGate | listingDraftService                | Upload seguro             |
| `/vendedor/vendas`        | Vendas              | seller | AuthGate | sellerSaleService                  | Escrow / status           |
| `/vendedor/vendas/$id`    | Detalhe da venda    | seller | AuthGate | sellerSaleService                  | Chat + entrega + mediação |
| `/vendedor/financeiro`    | Financeiro          | seller | AuthGate | platformEconomicsService           | Wallet + saque            |
| `/vendedor/avaliacoes`    | Avaliações          | seller | AuthGate | reviewService                      | Persistência              |
| `/vendedor/equipe`        | Equipe              | seller | AuthGate | sellerTeamService                  | RBAC vendedor             |

## 4. Rotas admin

**`/admin/denuncias` é oficial** — não usar `/admin/reclamacoes`.

| Rota                   | Finalidade            | Auth  | Gate      | Service                                | Backend futuro             |
| ---------------------- | --------------------- | ----- | --------- | -------------------------------------- | -------------------------- |
| `/admin`               | Dashboard admin       | admin | AdminGate | adminService                           | Métricas                   |
| `/admin/usuarios`      | Usuários              | admin | AdminGate | adminService                           | Search + audit             |
| `/admin/vendedores`    | Vendedores            | admin | AdminGate | adminService                           | Aprovação + KYC            |
| `/admin/anuncios`      | Moderação anúncios    | admin | AdminGate | adminService                           | Fila + ações               |
| `/admin/pedidos`       | Pedidos globais       | admin | AdminGate | adminService                           | Filtros + export           |
| `/admin/transacoes`    | Transações            | admin | AdminGate | adminAdvancedService                   | Conciliação                |
| `/admin/disputas`      | Disputas              | admin | AdminGate | adminAdvancedService                   | Workflow                   |
| `/admin/denuncias`     | Denúncias             | admin | AdminGate | reportService                          | Fila + moderação           |
| `/admin/configuracoes` | Configurações         | admin | AdminGate | adminAdvancedService                   | Feature flags              |
| `/admin/catalogo`      | Catálogo              | admin | AdminGate | adminAdvancedService                   | Categorias + subcategorias |
| `/admin/permissoes`    | Papéis                | admin | AdminGate | adminAdvancedService                   | RBAC real                  |
| `/admin/verificacoes`  | KYC                   | admin | AdminGate | verificationService                    | Provedor KYC               |
| `/admin/financeiro`    | Financeiro plataforma | admin | AdminGate | adminAdvancedService                   | Contabilidade              |
| `/admin/conteudo`      | Conteúdo / e-mails    | admin | AdminGate | transactionalEmailService, infoService | CMS + templates            |
| `/admin/relatorios`    | Relatórios            | admin | AdminGate | adminAdvancedService                   | BI                         |
| `/admin/auditoria`     | Trilha de auditoria   | admin | AdminGate | adminAdvancedService                   | Logs imutáveis             |

## Observações

- Nenhuma dessas rotas depende de rede real.
- Todos os `Gate` são visuais e devem virar server-side no backend.
- 404 amigável servido pelo `notFoundComponent` do root.
- SEO base: `buildSeoHead` em `src/components/seo/Seo.tsx`
  (limitações SPA documentadas em `ARCHITECTURE.md`).

## Sprint 2C2B1 — rotas de autenticação reais

- `/cadastro`: envia `RegisterDto` real (`email`, `password`, `birthDate`, aceites e versões de termos/privacidade, `deviceName` opcional) e redireciona para verificação sem autenticar automaticamente.
- `/verificar-email`: processa token de URL, limpa a URL e permite reenvio genérico.
- `/login`: trata sucesso 200, `DEVICE_APPROVAL_REQUIRED` e `TWO_FACTOR_REQUIRED` (202) sem autenticar antes do challenge.
- `/verificacao-login`: aprova dispositivo por token, reenvia aprovação e conclui login 2FA por código ou recovery code.
- `/recuperar-senha` e `/redefinir-senha`: chamam endpoints reais de password forgot/reset com mensagens seguras.

## Sprint 2C2B2A — Central de Segurança

| Rota                | Tela                          | Acesso | Guard    | Serviço                              | Status      |
| ------------------- | ----------------------------- | ------ | -------- | ------------------------------------ | ----------- |
| `/perfil/seguranca` | Central de segurança da conta | user   | AuthGate | authSecurityService + TanStack Query | Real NestJS |

## Sprint 2C2B2B1

| Rota                         | Arquivo                                    | Estado                                                                                                                |
| ---------------------------- | ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| `/perfil/seguranca`          | `src/routes/perfil.seguranca.tsx`          | Central real de segurança com sessões, dispositivos, senha, telefone e solicitação de alteração de e-mail.            |
| `/confirmar-alteracao-email` | `src/routes/confirmar-alteracao-email.tsx` | Rota pública para dupla confirmação de alteração de e-mail; remove `token` da URL e solicita o novo e-mail novamente. |

## Sprint 2C2B2B2A — 2FA na Central de Segurança

| Rota                | Arquivo                           | Estado                                                                                                                                                                                                                |
| ------------------- | --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/perfil/seguranca` | `src/routes/perfil.seguranca.tsx` | Central real de segurança com sessões, dispositivos, senha, telefone, e-mail e 2FA: status real, ativação EMAIL/SMS, exibição única de recovery codes `XXXXX-XXXXX-XXXXX`, desativação e revogação segura de sessões. |

Step-up, troca de método 2FA e regeneração de recovery codes não foram adicionados nesta rota.
