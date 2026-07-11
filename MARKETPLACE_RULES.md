# MARKETPLACE_RULES.md — LIT Buy

Regras oficiais de produto da LIT Buy como marketplace intermediador de produtos digitais. Este documento é a fonte de verdade para decisões de escopo. Tudo hoje é mockado — as regras abaixo guiam a implementação real futura.

## Contas e papéis

- Toda conta comum pode **comprar e vender** — não existem contas separadas de comprador e vendedor.
- `activeRole` é apenas **contexto visual** (define qual painel a UI está exibindo). Nunca é usado como permissão de negócio.
- `hasSellerProfile` é campo legado — não gate de acesso. O acesso ao painel `/vendedor` exige apenas login.
- **Admin é acesso especial**, restrito a contas explicitamente marcadas (hoje: `admin@litbuy.com`, mock). Admin real exigirá backend + tabela `user_roles` + `has_role()` + RLS.

## Rotas e superfícies

- `/` — Home pública.
- `/produto/$id` — Página pública de produto.
- `/loja/$slug` — **Perfil público** do vendedor (qualquer visitante pode ver).
- `/carrinho`, `/checkout` — Fluxo de compra (mock).
- `/conta/*` — Área privada do usuário (comprador).
- `/vendedor/*` — **Painel privado** do vendedor. Requer login.
- `/admin/*` — **Painel administrativo**. Requer login + `isAdmin`.

## Produtos digitais

- Produtos são digitais por padrão. **Entrega precisa ser controlada** (ver `DIGITAL_DELIVERY_FLOW.md`).
- Um produto só pode ser **comprado** se:
  - `status === 'active'`
  - `stock > 0`
- Status de anúncio segue `LISTING_STATUS_RULES.md`.

## Compra, pagamento e carteira

- **Compra real exigirá backend.** O checkout atual é mock — não movimenta dinheiro, não emite recibo, não persiste pedido.
- **Pagamento real exigirá backend** com gateway (Stripe/Paddle/etc.) e webhooks verificados.
- **Carteira real exigirá backend.** Cálculos financeiros (bruto, taxa, líquido, pendente, disponível) devem ser feitos no servidor. Ver `WALLET_AND_ESCROW_RULES.md`.
- Frontend nunca decide valor final, taxa, ou saldo liberado.

## Disputas

- **Disputas reais exigirão backend e admin real.** Fluxo mockado apenas para demonstração. Ver `DISPUTE_FLOW.md`.
- Enquanto houver disputa aberta, saldo do vendedor referente ao pedido fica bloqueado.

## Avaliações

- Avaliação só pode ser criada por comprador **após pedido concluído** (`completed`).
- Cada avaliação está vinculada a um `order_item` específico — não a produto/vendedor de forma livre.
- Ver `REVIEW_RULES.md`.

## Mensagens

- Conversa entre comprador e vendedor pode ser pré-compra (dúvida) ou vinculada a pedido.
- Mensagens vinculadas a pedido podem ser usadas como evidência em disputa.
- Ver `MESSAGING_RULES.md`.

## Admin

- Admin modera anúncios, denúncias, disputas, usuários e vendedores.
- Toda ação administrativa gera **audit log** imutável (ver `DATABASE_SCHEMA.md`).
- Admin nunca edita saldo financeiro diretamente pelo frontend.

## Estado atual (mock)

- Não há backend, persistência, autenticação real, permissão real, pagamento real, entrega real, disputa real, carteira real, avaliação real ou chat real.
- Todas as ações administrativas e financeiras exibem apenas `toast` (sonner).

## Sprint 18.7 — Regras de anúncio avançado

- **Modelo do anúncio**: Normal (um produto), Dinâmico (variações) ou Serviço.
- **Entrega automática**: exige cofre seguro com estoque em linhas — real
  apenas com backend.
- **LIT-MAX**: plano premium do vendedor; libera mensagem automática ao
  comprador após pagamento.
- **Planos de destaque**: Prata / Ouro / Diamante alteram visibilidade e
  taxa demonstrativa.
- **Campos especiais para Conta**: procedência, recuperação, verificações
  e garantia informada ficam anexos ao anúncio.

## Sprint 18.8 — regras do lado comprador

- **Perguntas públicas** aparecem no anúncio e ajudam outros compradores;
  são distintas de mensagens privadas em /mensagens/$id.
- **Produto dinâmico**: comprador precisa selecionar variação antes de comprar;
  variações sem estoque/pausadas ficam bloqueadas.
- **Serviço sob orçamento**: não permite adicionar ao carrinho direto;
  encaminha para conversa com o vendedor.
- **Moeda virtual**: cotação visual demonstrativa (unit price × quantidade),
  quantidade mínima e estoque exibidos; multi-vendedor real será backend.
- **Anti-evasão de taxas**: contato externo em qualquer canal público ou privado
  é censurado visualmente. Negociação fora da LIT Buy remove a proteção.

## Sprint 18.10 — LIT Points, Tarifas, Prazos e Níveis de Vendedor

- Programa LIT Points é próprio da LIT Buy. Não é dinheiro, não é saldo financeiro, não pode ser sacado.
- Rotas públicas `/lit-points` e `/taxas` explicam programa, tarifas, prazos e níveis de vendedor.
- Níveis Bronze/Prata/Ouro/Diamante/Elite são visuais e mockados.
- Taxas e prazos exibidos são demonstrativos. Cálculo real, cobrança, split, escrow, saques e assinatura LIT-MAX exigem backend.
- Saldo LIT é separado de LIT Points. Saldo pendente/disponível/bloqueado é apenas visual.
- Services: `litPointsService`, `sellerLevelService`, `platformEconomicsService` — todos mockados, sem persistência.
- Integrações leves em `/carteira`, `/vendedor`, `/vendedor/financeiro`, `/loja/$slug` e `/produto/$id`.
- Footer aponta para `/lit-points` e `/taxas`.
