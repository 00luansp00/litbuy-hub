# QA Checklist — LIT Buy

Checklist manual para validar a estabilidade do MVP antes de novas sprints.
Marque cada item ao rodar a suíte manual em desktop, tablet e mobile.

---

## 1. Navegação

- [ ] Navbar carrega em todas as páginas sem erro visual.
- [ ] Logo leva para `/`.
- [ ] Dropdown de categorias abre e cada item leva para `/categoria/$slug`.
- [ ] Links de "Início", "Contas", "Gift Cards", "Serviços" funcionam.
- [ ] UserMenu abre e todos os itens levam para rotas válidas.
- [ ] Footer carrega e nenhum link quebra a aplicação.
- [ ] Botão de menu mobile abre/fecha corretamente.

## 2. Home (`/`)

- [ ] Hero renderiza com CTA visível.
- [ ] CategoriesGrid mostra todas as categorias.
- [ ] Seções "Em destaque", "Populares agora", "Chegou agora" carregam produtos.
- [ ] MarketplaceStats, Benefits e Newsletter aparecem.
- [ ] Nenhum erro no console.

## 3. Autenticação mock

- [ ] `/login` renderiza AuthCard com email/senha.
- [ ] `/cadastro` renderiza formulário completo.
- [ ] `/recuperar-senha` renderiza formulário de recuperação.
- [ ] Após login mockado, UserMenu reflete estado autenticado.
- [ ] Logout retorna ao estado anônimo.

## 4. Categoria (`/categoria/$slug`)

- [ ] Categoria válida (ex: `contas`) carrega Hero + Grid.
- [ ] Slug inválido dispara `notFoundComponent` (EmptyState).
- [ ] Sidebar de filtros aparece em desktop; Sheet em mobile.
- [ ] SortBar mostra total correto.
- [ ] ProductGrid mostra skeletons durante loading.
- [ ] EmptyState aparece quando não há produtos.

## 5. Produto (`/produto/$id`)

- [ ] Produto válido carrega galeria, info, PurchaseCard.
- [ ] Breadcrumb reflete categoria → produto.
- [ ] SellerInfo (variante detailed) linka para `/loja/$slug`.
- [ ] Reviews e Description renderizam.
- [ ] Produtos relacionados aparecem.
- [ ] ID inválido cai em EmptyState.

## 6. Loja pública (`/loja/$slug`)

- [ ] Vendedor válido carrega SellerHero, Stats, About, Badges.
- [ ] SellerProducts lista produtos do vendedor.
- [ ] SellerReviews mostra distribuição e comentários.
- [ ] ContactSellerCard dispara toasts (chat, seguir, compartilhar).
- [ ] Slug inválido cai em EmptyState.

## 7. Rotas placeholder

- [ ] `/carrinho`, `/checkout`, `/perfil`, `/pedidos`, `/favoritos`,
      `/mensagens`, `/carteira`, `/vendedor`, `/admin` carregam
      PlaceholderPage sem erro.

## 8. Responsividade

- [ ] Home: hero, grids e sections não estouram largura em 375px.
- [ ] Categoria: sidebar vira Sheet no mobile; grid usa 2 colunas.
- [ ] Produto: galeria empilha; PurchaseCard não fica sticky ruim.
- [ ] Loja: hero e stats se adaptam a mobile.
- [ ] Login/Cadastro: formulários centralizados e sem overflow.

## 9. Estados vazios e loading

- [ ] Skeletons aparecem nos grids durante loading simulado.
- [ ] EmptyState renderiza com ícone, título, descrição e CTA.
- [ ] notFoundComponent das rotas dinâmicas está ativo.

## 10. Ações mockadas (feedback visual)

- [ ] Favoritar → toast.
- [ ] Compartilhar → toast + copia URL.
- [ ] Seguir vendedor → toast.
- [ ] Enviar mensagem → toast "em breve".
- [ ] Adicionar ao carrinho / Comprar agora → toast.

## 11. Links internos

- [ ] ProductCard → `/produto/$id`.
- [ ] CategoryCard → `/categoria/$slug`.
- [ ] SellerInfo (com href) → `/loja/$slug`.
- [ ] Breadcrumb navega para níveis superiores.

## 12. Console e build

- [ ] Nenhum erro vermelho no console em nenhuma rota.
- [ ] Sem warnings de key ausente em listas.
- [ ] `bun run build` completa sem erro.
- [ ] Typecheck limpo (`tsgo --noEmit`).

## Painel Administrativo (mock)

- [ ] `/admin` carrega dashboard com métricas, alertas, atividade, pedidos, disputas e vendedores em destaque
- [ ] `/admin` mostra tela "Acesso restrito" quando `isAdmin` for `false`
- [ ] `/admin` mostra tela de login quando usuário não estiver autenticado
- [ ] `/admin/usuarios` lista usuários mockados com filtros de busca/status/risco
- [ ] `/admin/vendedores` lista vendedores mockados com filtros
- [ ] `/admin/anuncios` lista anúncios mockados com filtros
- [ ] `/admin/pedidos` lista pedidos mockados com filtros
- [ ] `/admin/transacoes` lista transações mockadas com filtros
- [ ] `/admin/disputas` lista disputas mockadas com filtros
- [ ] `/admin/denuncias` lista denúncias mockadas com filtros
- [ ] `/admin/configuracoes` mostra seções visuais e botões "Salvar" com toast
- [ ] Todas as ações administrativas exibem toast informando que são mockadas
- [ ] Menu do usuário exibe "Painel administrativo" quando `isAdmin` é true
- [ ] Sidebar admin funciona em desktop e menu horizontal em mobile
- [ ] Nenhuma ação persiste dados, nenhum backend é acionado

## Navegação e Rotas (Hotfix 16.2)

### Navbar
- [ ] Logo volta para `/`
- [ ] Ícone do carrinho abre `/carrinho` e mostra contador correto
- [ ] Links de "Entrar" e "Criar conta" abrem `/login` e `/cadastro`
- [ ] Avatar abre `UserMenu` quando autenticado

### UserMenu — modo comprador
- [ ] Meu perfil → `/perfil`
- [ ] Pedidos → `/pedidos`
- [ ] Favoritos → `/favoritos`
- [ ] Carteira → `/carteira`
- [ ] Mensagens → `/mensagens`
- [ ] "Vender na LIT Buy" → `/vendedor` (com toast se sem perfil)
- [ ] "Painel administrativo" só aparece se `isAdmin`
- [ ] Sair mostra toast e desloga

### UserMenu — modo vendedor
- [ ] Painel do vendedor → `/vendedor`
- [ ] Meus anúncios → `/vendedor/anuncios`
- [ ] Criar anúncio → `/vendedor/anuncios/novo`
- [ ] Vendas → `/vendedor/vendas`
- [ ] Financeiro → `/vendedor/financeiro`
- [ ] Minha loja pública → `/loja/$slug`
- [ ] "Mudar para modo comprador" volta com toast

### Área do vendedor
- [ ] Sidebar destaca a rota ativa
- [ ] Botão "Criar anúncio" (header + sidebar + quick actions) abre `/vendedor/anuncios/novo`
- [ ] "Ver loja pública" abre `/loja/$slug`
- [ ] "Voltar para minha conta" abre `/perfil`
- [ ] Todas as subrotas carregam sem ficar presas no dashboard

### Área admin
- [ ] Sidebar destaca a rota ativa
- [ ] Todas as subrotas carregam dentro do `AdminLayout`
- [ ] "Voltar ao marketplace" abre `/`
- [ ] Ações administrativas exibem toast

### Produto
- [ ] Breadcrumb navega corretamente
- [ ] Link do vendedor abre `/loja/$slug`
- [ ] Link da categoria abre `/categoria/$slug`
- [ ] Produtos relacionados abrem `/produto/$id`
- [ ] Produto indisponível bloqueia compra e carrinho

### Loja pública
- [ ] Produtos da loja abrem `/produto/$id`
- [ ] Ações mockadas (seguir, mensagem, compartilhar) exibem toast
- [ ] Slug inexistente exibe EmptyState

### Carrinho e checkout
- [ ] "Continuar comprando" (carrinho vazio) leva a rota válida
- [ ] "Ir para checkout" só habilita com itens no carrinho
- [ ] "Editar carrinho" no checkout volta para `/carrinho`
- [ ] Item indisponível bloqueia finalização
- [ ] Após sucesso: "Ver meus pedidos" → `/pedidos`, "Continuar comprando" → `/`

## QA Geral do MVP (Sprint 17)

### Typecheck e build
- [ ] `bunx tsgo --noEmit` roda sem erros
- [ ] Nenhum import quebrado no console do preview
- [ ] Nenhum warning novo de hidratação

### Services
- [ ] Nenhuma rota em `src/routes/` importa de `src/data/` diretamente
- [ ] `productService`, `categoryService`, `sellerService`, `reviewService`, `accountService`, `cartService`, `checkoutService`, `sellerDashboardService`, `adminService` continuam expostos

### Providers
- [ ] `AuthProvider` disponível em toda a app; `useAuth()` funciona
- [ ] `CartProvider` disponível em toda a app; `useCart()` funciona
- [ ] Alternância comprador ↔ vendedor funciona no `UserMenu`
- [ ] Contador do carrinho atualiza ao adicionar/remover item

### Rotas principais
- [ ] Todas as rotas listadas em `ROUTE_AUDIT.md` carregam sem erro
- [ ] Nenhuma rota fica em branco após navegação (parent com `<Outlet />`)
- [ ] `/vendedor/anuncios/novo` continua abrindo o wizard

### Responsividade
- [ ] Sem overflow horizontal na home em 375px
- [ ] Sidebar do vendedor vira menu horizontal no mobile
- [ ] Sidebar do admin vira menu horizontal no mobile
- [ ] Tabelas (admin/vendedor) rolam horizontalmente no mobile

### Produtos indisponíveis
- [ ] `ProductCard` mostra badge e desabilita CTA
- [ ] `PurchaseCard` bloqueia compra e adicionar ao carrinho
- [ ] `CartProvider.addItem` recusa e mostra toast
- [ ] Checkout bloqueia finalização se houver item indisponível

### Carrinho e checkout
- [ ] Adicionar/remover/atualizar quantidade funciona
- [ ] Cupom mockado aplica desconto
- [ ] Checkout exige login (`AuthGate`)
- [ ] Sucesso do checkout deixa claro que não houve cobrança real

### Vendedor
- [ ] Sidebar destaca rota ativa
- [ ] Wizard `/vendedor/anuncios/novo` mostra `ImageUploader`
- [ ] Financeiro deixa claro que é mockado

### Admin
- [ ] `AdminGate` bloqueia acesso quando `isAdmin` é false
- [ ] Todas as ações administrativas exibem toast mockado
- [ ] Nenhuma rota admin importa `src/data/` diretamente

### Ações mockadas
- [ ] Favoritar / compartilhar / seguir / enviar mensagem exibem toast
- [ ] Editar perfil exibe toast
- [ ] Sacar / adicionar saldo exibe toast
- [ ] Publicar / pausar / editar anúncio exibe toast
- [ ] Ações de disputa e denúncia exibem toast

### Console
- [ ] Sem erros vermelhos no console do navegador
- [ ] Sem 404 de assets no painel de rede

## Polimento Visual (Sprint 18)

### Headers de página
- [ ] Título e subtítulo consistentes entre `/perfil`, `/vendedor` e `/admin`
- [ ] Badges de contexto ("Modo demonstração", "Admin", "Protegido") aparecem onde faz sentido
- [ ] Breadcrumbs (quando existem) usam o componente `Breadcrumb`

### Cards
- [ ] Bordas, sombras e espaçamento internos consistentes
- [ ] Hover discreto (sem transformações exageradas)
- [ ] Alinhamento de CTAs no rodapé do card

### Botões e CTAs
- [ ] Primário / secundário / destructive claramente distintos
- [ ] Nenhum botão fica mudo — ação real ou toast
- [ ] Botões desabilitados legíveis (produto indisponível, checkout vazio)

### Toasts
- [ ] Mensagens curtas, em pt-BR, sem termos técnicos
- [ ] "Adicionado ao carrinho", "Produto indisponível no momento", "Nenhuma cobrança real foi realizada"
- [ ] Sonner é a única API de toast usada

### EmptyStates
- [ ] Todos usam o componente `EmptyState` (ícone + título + descrição + CTA)
- [ ] Carrinho vazio, checkout vazio, favoritos, mensagens, pedidos, listas admin

### Responsividade
- [ ] Sem overflow horizontal em 375px nas áreas principais
- [ ] Sidebar do vendedor e do admin viram menu horizontal no mobile
- [ ] Cards não estouram largura em 375px
- [ ] Sticky do checkout/produto não quebra no mobile

### Tabelas mobile
- [ ] `SellerListingsTable` rola horizontalmente sem cortar conteúdo
- [ ] Tabelas admin (pedidos, transações, disputas, denúncias) rolam sem quebrar

### Sidebars
- [ ] `AccountSidebar`, `SellerDashboardSidebar`, `AdminSidebar` destacam item ativo
- [ ] CTA secundário ("Vender na LIT Buy", "Voltar para minha conta", "Voltar ao marketplace") presente

### Acessibilidade básica
- [ ] Botões ícone-only têm `aria-label`
- [ ] Inputs têm `<Label>` ou `aria-label`
- [ ] Foco visível em botões, links e inputs
- [ ] Contraste OK — apenas tokens `text-foreground` / `text-muted-foreground`, sem `text-gray-*` arbitrários
- [ ] Nenhuma cor é o único indicador de status (sempre acompanha texto/ícone)

### Microinterações
- [ ] Framer Motion apenas em entradas de seção e hovers de card
- [ ] Nenhuma animação bloqueia interação do usuário

---

## Sprint 18.6 — QA final dos fluxos críticos

### Busca global (`/buscar`)
- [ ] Navbar (desktop e mobile) submete `<form>` para `/buscar?q=termo`.
- [ ] `/buscar` sem `q` renderiza estado inicial (buscas populares + categorias).
- [ ] `/buscar?q=steam` mostra resultados via `ProductGrid`/`ProductCard`.
- [ ] `SearchFiltersPanel` (categoria, preço, entrega, vendedor, disponibilidade, avaliação, plataforma) não quebra ao alternar filtros.
- [ ] `SearchSortBar` reordena resultados sem crash.
- [ ] `EmptyState` aparece quando nenhum resultado combina.
- [ ] Nenhuma rota consome `@/data/*` diretamente para busca — sempre `searchService`.

### Pedidos (`/pedidos` e `/pedidos/$id`)
- [ ] `/pedidos` lista pedidos do comprador via `orderService`.
- [ ] `RecentOrdersCard` "Ver detalhes" abre `/pedidos/$id`.
- [ ] `/pedidos/$id` cai em `notFoundComponent` para id inexistente.
- [ ] Header do pedido mostra código, data, total e método de pagamento.
- [ ] `OrderTimeline` renderiza eventos com ícones e horários.
- [ ] `OrderItemsList` linka produto e loja do vendedor.
- [ ] `AuthGate` bloqueia o detalhe quando deslogado.

### Entrega digital
- [ ] `DigitalDeliveryCard` mostra status e método (auto/manual).
- [ ] Payload aparece mascarado (`••••`) com blur até o "Revelar".
- [ ] Botão "Revelar" apenas dispara toast — nenhum dado sensível real.
- [ ] Ação "Confirmar recebimento" é toast e sinaliza liberação de pagamento em produção.
- [ ] Aviso de segurança (`OrderSecurityNotice`) aparece no aside.

### Disputa visual
- [ ] `OrderDisputeCard` abre modal com motivo + descrição.
- [ ] Envio dispara toast via `orderService.simulateOpenDispute` sem persistir.
- [ ] Disputa existente aparece com status; disputa é bloqueada em pedidos `cancelled`/`refunded`.

### Avaliação visual
- [ ] `OrderReviewCard` só libera formulário quando `status === "completed"`.
- [ ] Avaliação separada de produto e vendedor.
- [ ] Envio dispara toast via `orderService.simulateSubmitReview` — nenhuma nota é salva.

### Mensagens (`/mensagens` e `/mensagens/$id`)
- [ ] `/mensagens` mostra lista de conversas + painel vazio no desktop.
- [ ] `/mensagens` em mobile mostra somente a lista.
- [ ] `/mensagens/$id` abre `ConversationHeader`, `ConversationContextCard`, `MessagesThread` e `MessageComposer`.
- [ ] Contexto pré-compra: mostra produto + botão "Ver produto".
- [ ] Contexto pós-compra: mostra pedido + botão "Ver pedido".
- [ ] Contexto suporte: mostra aviso oficial (sem produto).
- [ ] Composer envia via `simulateSendMessage` e adiciona a mensagem só ao estado local.
- [ ] Anexo / emoji disparam toast "Em breve".
- [ ] `MessageSecurityNotice` visível em ambas as telas.
- [ ] `ContactSellerCard` (loja) e `OrderActionsCard` (pedido) apontam para `/mensagens`.
- [ ] `RecentMessagesCard` "Abrir" linka para `/mensagens`.
- [ ] `AuthGate` bloqueia mensagens quando deslogado.
- [ ] Id inválido em `/mensagens/$id` cai em `notFoundComponent`.

### Compra e checkout
- [ ] `ProductCard` adiciona ao carrinho normalmente.
- [ ] Produto indisponível é bloqueado por `getUnavailabilityReason` (`ProductCard`/`PurchaseCard`).
- [ ] `PurchaseCard` respeita estoque e status.
- [ ] `/carrinho` funciona (aumentar/diminuir/remover).
- [ ] `/checkout` funciona e exige login via `AuthGate`.
- [ ] Sucesso do checkout deixa claro que nenhuma cobrança real foi feita.
- [ ] Pedido fictício NÃO é persistido em backend/LocalStorage.

### Vendedor
- [ ] `/vendedor` carrega dashboard.
- [ ] `/vendedor/anuncios` e `/vendedor/anuncios/novo` carregam; `ImageUploader` aparece (mock).
- [ ] `/vendedor/vendas`, `/vendedor/financeiro`, `/vendedor/avaliacoes` carregam.
- [ ] Botões mockados usam toast.
- [ ] Todos usuários logados podem vender — nenhuma barreira real.

### Admin
- [ ] `/admin` exige AdminGate.
- [ ] `admin@litbuy.com` ativa `isAdmin` no `AuthProvider`.
- [ ] Usuário comum é bloqueado no AdminGate.
- [ ] Subrotas `/admin/usuarios`, `/admin/vendedores`, `/admin/anuncios`, `/admin/pedidos`, `/admin/transacoes`, `/admin/disputas`, `/admin/denuncias`, `/admin/configuracoes` carregam.
- [ ] Ações admin usam toast e sinalizam modo demonstração.

### Regras globais
- [ ] Ações mockadas sempre têm toast em pt-BR.
- [ ] Nenhum dado sensível real é exibido em qualquer tela.
- [ ] `sonner` continua sendo a única API de toast.
- [ ] Typecheck (`tsgo --noEmit`) passa limpo.

### Handoff técnico
- [ ] `MVP_STATUS.md` reflete todas as sprints 17→18.5.
- [ ] `PROJECT_RULES.md` documenta regras de mensagens/pedidos/pós-compra.
- [ ] `MARKETPLACE_RULES.md`, `ORDER_LIFECYCLE.md`, `DIGITAL_DELIVERY_FLOW.md`, `DISPUTE_FLOW.md`, `WALLET_AND_ESCROW_RULES.md`, `LISTING_STATUS_RULES.md`, `REVIEW_RULES.md`, `MESSAGING_RULES.md` presentes.
- [ ] `SECURITY_NOTES.md` presente e coerente com o modelo mockado.
- [ ] Nenhum backend, Supabase, WebSocket, pagamento, upload ou permissão real foi implementado no MVP.
