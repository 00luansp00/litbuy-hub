# SERVICES_MAP.md — LIT Buy

Todos os services vivem em `src/services/` e são **mockados**. Nenhum
faz IO real. Cada um deverá virar cliente de API/RPC no backend.

## productService (`src/services/productService.ts`)
- **Responsabilidade**: catálogo de produtos, busca por id/categoria,
  produtos em destaque.
- **Mock**: `src/data/products.ts`.
- **Consumido por**: `/`, `/buscar`, `/categoria/$slug`, `/produto/$id`,
  `/loja/$slug`, `/favoritos`, `ProductCard`, `ProductGrid`.
- **Backend futuro**: `GET /products`, `GET /products/:id`,
  validação de status/estoque/aprovação, preço server-side.

## categoryService / `src/data/categories.ts`
- **Responsabilidade**: categorias e subcategorias.
- **Backend futuro**: tabela `categories`, admin gerencia CRUD.

## sellerService (`src/services/sellerService.ts`)
- **Responsabilidade**: perfis públicos, produtos da loja, badges.
- **Mock**: `src/data/sellers.ts`.
- **Consumido por**: `/loja/$slug`, `PurchaseCard`, `ProductInfo`.
- **Backend futuro**: `GET /sellers/:slug` + join com nível/KYC.

## reviewService
- **Responsabilidade**: avaliações de produtos/vendedores.
- **Backend futuro**: `reviews` com moderação e antifraude.

## accountService
- **Responsabilidade**: dados do usuário logado, saldos, favoritos,
  quick actions em `/perfil`.
- **Backend futuro**: `GET /me`, endpoints por seção.

## cartService (`src/services/cartService.ts`)
- **Responsabilidade**: itens do carrinho, cupom, Proteção LIT.
- **Estado**: memória via `CartProvider`.
- **Backend futuro**: cart server-side (idempotente),
  preço/estoque recalculado no backend.

## checkoutService
- **Responsabilidade**: montar payload de checkout, resumo, LIT Points.
- **Backend futuro**: `POST /checkout` + reserva de estoque + antifraude.

## paymentService (`src/services/paymentService.ts`)
- **Responsabilidade**: gerar PaymentIntent falso, listar métodos.
- **Backend futuro**: integração com gateway (Pix, boleto, cartão),
  webhooks, idempotência.

## orderService
- **Responsabilidade**: pedidos do usuário, timeline, ações do comprador.
- **Backend futuro**: `orders`, `order_items`, transições auditadas.

## orderSupportService
- **Responsabilidade**: prazos de mediação, mensagens automáticas,
  motivos de mediação.
- **Backend futuro**: cron para expirar prazos + workflow de mediação.

## messageService
- **Responsabilidade**: conversas, mensagens, sanitização LIT-MAX.
- **Backend futuro**: realtime + moderação server-side + storage
  de anexos.

## sellerSaleService
- **Responsabilidade**: vendas do vendedor, detalhe, entrega manual.
- **Backend futuro**: escrow, status, prazos.

## sellerDashboardService
- **Responsabilidade**: métricas do painel vendedor.
- **Backend futuro**: agregações BI.

## adminService / adminAdvancedService
- **Responsabilidade**: dados administrativos.
- **Backend futuro**: endpoints protegidos por RBAC + auditoria.

## searchService
- **Responsabilidade**: sugestões, populares.
- **Backend futuro**: busca full-text (Postgres FTS, Meilisearch,
  Typesense).

## listingDraftService
- **Responsabilidade**: rascunhos do wizard de anúncio.
- **Backend futuro**: persistência de rascunho + upload de mídia.

## questionService
- **Responsabilidade**: perguntas públicas em produto.
- **Backend futuro**: moderação + notificação para vendedor.

## analyticsService
- **Responsabilidade**: track de eventos (console.debug em dev).
- **Backend futuro**: provedor (GA4/PostHog/Plausible) + consent LGPD.

## litPointsService
- **Responsabilidade**: saldo e regras de LIT Points.
- **Backend futuro**: ledger financeiro (não pode viver no client).

## sellerLevelService
- **Responsabilidade**: níveis do vendedor (LIT-MAX etc.).
- **Backend futuro**: cálculo periódico server-side.

## platformEconomicsService
- **Responsabilidade**: taxas, cofre seguro visual, financeiro plataforma.
- **Backend futuro**: contabilidade + relatórios.

## verificationService
- **Responsabilidade**: fluxo visual de KYC (SMS/documento/selfie).
- **Backend futuro**: provedor KYC (Idwall/Unico/Jumio).

## sellerTeamService
- **Responsabilidade**: membros e cargos do time do vendedor.
- **Backend futuro**: RBAC vendedor + convites com token.

## notificationService
- **Responsabilidade**: notificações in-app.
- **Backend futuro**: fila + push + e-mail + realtime.

## reportService
- **Responsabilidade**: denúncias (produto, loja, mensagem, pedido, venda).
- **Backend futuro**: fila de moderação + evidências assinadas.

## affiliateService
- **Responsabilidade**: dashboard de afiliado, links, conversões.
- **Backend futuro**: tracking real, atribuição, antifraude, saque.

## infoService
- **Responsabilidade**: conteúdo das páginas institucionais.
- **Backend futuro**: CMS + versão jurídica com revisão.

## transactionalEmailService
- **Responsabilidade**: templates, preferências, histórico visual.
- **Backend futuro**: provedor (Resend/SendGrid/SES), token opt-out,
  auditoria.

## authMock (`src/services/authMock.ts`)
- **Responsabilidade**: login/cadastro em memória.
- **Backend futuro**: Auth real (Supabase Auth ou similar).

## Riscos comuns

- Todos retornam dados estáticos — não confiar em nada disso em produção.
- `any` proibido; usar tipos de `src/types/index.ts`.
- Substituir chamadas por Query hooks ligados aos endpoints reais.
