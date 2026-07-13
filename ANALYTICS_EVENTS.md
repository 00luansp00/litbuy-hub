# ANALYTICS_EVENTS.md — Eventos de analytics (mock)

Sprint 18.9 introduziu `src/services/analyticsService.ts`, um gancho
mockado para eventos que serão instrumentados no futuro. Nenhum provider
real (GA4, Meta Pixel, TikTok, Segment, etc.) está instalado.

Em desenvolvimento, `analyticsService.track()` faz `console.debug`.
Em produção real, o service deverá encaminhar para o provider escolhido,
idealmente **server-side**.

## Eventos catalogados

| Evento | Onde disparar | Payload sugerido |
| --- | --- | --- |
| `view_item` | Página de produto | `{ productId, price }` |
| `add_to_cart` | ProductCard/PurchaseCard | `{ productId, quantity, variantId? }` |
| `begin_checkout` | Entrada em `/checkout` | `{ itemCount, subtotal }` |
| `select_payment_method` | Seleção de método | `{ method }` |
| `add_protection_plan` | Seleção de Proteção | `{ plan }` |
| `generate_payment` | Geração do PaymentIntent | `{ method, total, protection }` |
| `purchase_mocked` | Após geração mock | `{ paymentId }` |
| `search` | Página `/buscar` | `{ query, results }` |
| `create_listing_mocked` | Wizard de anúncio | `{ model, productType }` |

## Regras

- Sem PII (nome, e-mail, telefone, CPF, endereço).
- Sem valores sensíveis de pagamento.
- Sem cookies de rastreamento — nada persiste no cliente.
- Preferir instrumentação server-side quando existir backend.

## Sprint 18.20 — Catálogo consolidado

Todos os eventos abaixo são disparados via `analyticsService.track(name, payload)`
e apenas fazem `console.debug` em `import.meta.env.DEV`. **Nada é enviado
para provedores reais.**

### Marketplace
`page_view_mocked`, `search_mocked`, `view_item_mocked`,
`select_item_mocked`, `add_to_cart_mocked`, `begin_checkout_mocked`,
`select_payment_method_mocked`, `generate_payment_mocked`,
`purchase_mocked`.

### Vendedor
`create_listing_started_mocked`, `create_listing_submitted_mocked`,
`seller_delivery_sent_mocked`, `seller_sale_viewed_mocked`.

### Pedido / Mediação
`order_viewed_mocked`, `order_chat_opened_mocked`,
`mediation_opened_mocked`, `mediation_submitted_mocked`,
`evidence_uploaded_mocked`, `order_problem_clicked_mocked`.

### Notificações / E-mails
`notification_clicked_mocked`, `communication_preferences_updated_mocked`,
`email_resend_clicked_mocked`, `email_verification_viewed_mocked`,
`email_template_previewed_mocked`.

### Admin
`admin_dashboard_viewed_mocked`, `admin_action_mocked`,
`admin_report_opened_mocked`.

### Afiliados
`affiliate_page_viewed_mocked`, `affiliate_link_copied_mocked`.

### Privacidade
- Nenhum PII (nome, e-mail, CPF, endereço, telefone) deve ser enviado.
- Nenhum dado de pagamento (cartão, CVV, chave Pix) deve ser enviado.
- Consentimento LGPD/GDPR será necessário antes de qualquer integração
  real (GA4, Meta Pixel, TikTok Pixel, PostHog, Plausible, etc.).
- Eventos de compra real só valem após confirmação do backend.
