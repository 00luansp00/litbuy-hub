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
