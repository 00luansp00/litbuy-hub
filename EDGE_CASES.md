# EDGE_CASES.md — Casos de borda (Sprint 18.20)

Este documento lista os edge cases visuais mapeados no MVP mockado da
LIT Buy. Todos são tratados no frontend com estados amigáveis
(EmptyState, RetryState, OfflineNotice, ErrorBoundary, toasts) e
deverão ser reforçados por validação real no backend futuramente.

## Catálogo / Produto
- Produto sem estoque.
- Variação sem estoque.
- Produto pausado ou removido.
- Categoria inativa.
- Subcategoria removida.
- Imagem quebrada (fallback visual).

## Carrinho / Checkout
- Carrinho vazio.
- Item indisponível no carrinho.
- Variação indisponível ao revisar.
- Serviço sob orçamento no carrinho.
- Cupom inválido/expirado (mock).
- Método de pagamento não selecionado.
- Saldo LIT insuficiente.
- LIT Points insuficientes.
- Falha mockada ao gerar pagamento (RetryState).
- Pagamento expirado (mock).
- Usuário offline durante checkout (OfflineNotice).

## Pedido / Mediação
- Pedido não encontrado.
- Venda não encontrada (vendedor).
- Conversa não encontrada.
- Mediação indisponível.
- Prazo de mediação expirado.
- Erro ao simular envio de mensagem.
- Denúncia duplicada.
- Evidência não anexada.
- Saldo bloqueado em mediação.
- Entrega automática indisponível (cofre vazio).

## Vendedor
- Vendedor suspenso.
- KYC recusado / pendente.
- Anúncio recusado pela moderação.
- Financeiro sem movimentações.
- Time sem membros.

## Notificações / E-mails
- Notificação sem link válido.
- E-mail transacional desativado nas preferências.
- Reenvio de e-mail solicitado (mock).
- Categoria de e-mail crítica (não pode desativar).

## Afiliados
- Afiliado suspenso.
- Sem conversões.
- Sem materiais ativos.
- Saque indisponível (saldo insuficiente).

## Admin
- Lista vazia.
- Filtro sem resultado.
- Item não encontrado.
- Ação mockada falhou (RetryState + toast).
- Usuário sem permissão visual (AdminGate).
- Rota admin inválida (404).

## Autenticação / Segurança
- E-mail não verificado.
- Novo dispositivo detectado.
- Token de redefinição de senha expirado (mock).
- Sessão expirada (visual).

## Rede / Runtime
- Usuário offline (OfflineNotice global).
- Erro de renderização capturado por ErrorBoundary.
- Página não encontrada (404 amigável).

Todos os fluxos acima são visuais/mockados. Nenhum dado é persistido.

## Sprint 18.21 — Reforços

- Hydration: componentes que dependem de `navigator`/`window`
  (ex.: `OfflineNotice`) só devem consultar essas APIs dentro de
  `useEffect`, retornando `null` até estar montado.
- 404: qualquer rota inválida cai no `NotFoundComponent` do root.
- ErrorBoundary: erros de renderização caem no fallback dark premium
  sem expor stack em produção.
