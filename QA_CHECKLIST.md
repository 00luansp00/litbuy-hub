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
