# PAYMENT_AND_ESCROW_IMPLEMENTATION_PLAN.md — LIT Buy

**Aviso**: pagamentos, wallet e escrow são a parte **mais crítica** do
produto. Exige desenvolvedor sênior, revisão de segurança, PCI-DSS (se
cartão), auditoria financeira e testes rigorosos antes de aceitar
dinheiro real.

**Dinheiro real jamais pode depender do frontend.**

## Métodos de pagamento

### Pix (Brasil)
- Integração via gateway (Stripe, PagBank, Mercado Pago, Asaas, Pagar.me)
  ou PSP autorizado pelo BCB.
- Gerar QR + copia-e-cola no backend.
- Webhook de confirmação **idempotente**.
- Timeout curto (15–30 min) — expira e libera estoque.

### Boleto
- Gateway gera código de barras + linha digitável.
- Vencimento configurável (D+2 típico).
- Webhook de compensação (~1 dia útil).

### Cartão de crédito/débito
- **Tokenização** pelo gateway (frontend recebe apenas token).
- **Nunca** trafegar/armazenar PAN, CVV, dados sensíveis pelo backend
  se não for PCI-DSS certificado.
- Suporte a 3D Secure quando aplicável.
- Antifraude do gateway + próprio.

## Provedores recomendados
- **Stripe** (internacional, PCI-DSS Level 1).
- **PagBank / PagSeguro** (BR).
- **Mercado Pago** (BR + LATAM).
- **Asaas** (BR, Pix nativo).
- **Adyen** (enterprise).

## Split
- Split automático via provedor quando suportado (Mercado Pago Marketplace,
  Stripe Connect, PagBank Split).
- Alternativa: split manual server-side + repasse via saque.

## Wallet e Escrow

### Modelo de saldos (por vendedor)
- **pending**: recebido do gateway, aguardando conclusão do pedido.
- **held**: em mediação/disputa.
- **available**: liberado para saque após prazo (D+X) e conclusão.
- **frozen**: bloqueado por antifraude/admin.

### Ledger
- Tabela `wallet_transactions` **append-only**.
- Cada mutação = 1 linha (`type`, `amount`, `from_bucket`, `to_bucket`,
  `order_id?`, `withdrawal_id?`, `metadata`).
- Saldo derivado (view materializada) + reconciliação diária.

### Fluxo típico de pedido
1. Comprador paga → gateway confirma → `payment.status = paid`.
2. Backend cria linha em `wallet_transactions` (crédito em `pending`
   do vendedor, líquido = valor − taxa plataforma − Proteção LIT).
3. Comprador confirma entrega OU prazo expira sem mediação →
   `pending` → `available`.
4. Se mediação aberta → `pending` → `held` até resolução.
5. Vendedor solicita saque → `available` → `withdrawal` (KYC obrigatório).

## Taxas e componentes

- **Taxa da plataforma**: percentual + fixo, configurável por categoria.
- **Proteção LIT**: opcional no checkout, calculada server-side.
- **LIT Points**: ledger separado (`lit_points_transactions`) — trata
  como moeda interna, nunca converter no client.
- **Cupom**: valida no backend (não confiar em desconto vindo do client).

## Chargeback / estorno / disputa

- Webhook de chargeback do gateway → status `disputed` no pedido.
- Bloquear `available` correspondente automaticamente.
- Interface admin para resposta com evidências.
- Se perder: debitar `wallet_transactions` (linha de estorno).
- Se ganhar: liberar de volta.

## Saques

- Endpoint `POST /withdrawals` exige:
  - KYC aprovado.
  - Saldo `available` suficiente.
  - Reautenticação (senha ou 2FA).
  - Limite diário/mensal.
- Estados: `requested` → `kyc_review` → `approved` → `paid` (ou
  `rejected`).
- Notificação em cada transição (e-mail + notification).
- Auditoria completa.

## Conciliação

- **Diária**: comparar total do gateway com `wallet_transactions`.
- **Alertar** divergência acima de tolerância mínima.
- **Retenção**: 7 anos (obrigatório fiscal BR).

## Idempotência

- Todo endpoint de pagamento aceita `Idempotency-Key`.
- Webhook do gateway: `idempotency_key UNIQUE` na tabela `payments`.
- Retry seguro sem duplicar cobrança.

## Auditoria financeira

- `audit_logs` para cada ação admin financeira.
- `wallet_transactions` append-only.
- Logs de webhook (raw payload) por 90 dias mínimo.

## Testes obrigatórios antes de dinheiro real

- Sandbox do gateway (Stripe test mode, MP sandbox).
- Testes de race condition (2 checkouts simultâneos).
- Testes de idempotência (webhook duplicado).
- Testes de rollback (falha no meio do fluxo).
- Testes de chargeback.
- Testes de saque com KYC negado.
- Auditoria externa (recomendado).

## Regras absolutas

- Nunca calcular preço final, taxa ou comissão no frontend.
- Nunca autorizar saque sem KYC + reautenticação.
- Nunca deletar linhas de `wallet_transactions`.
- Nunca aceitar webhook sem verificação de assinatura.
- Nunca armazenar dados de cartão fora do escopo do gateway.
- Nunca confiar em `amount` vindo do client no checkout.
