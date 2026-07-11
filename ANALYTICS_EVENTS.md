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
