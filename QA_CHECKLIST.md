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
