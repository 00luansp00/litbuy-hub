import type {
  CheckoutAnalyticsEvent,
  CheckoutAnalyticsEventName,
} from "@/types";

/**
 * analyticsService — Sprint 18.9
 *
 * Ganchos de analytics MOCKADOS. Nenhum evento real é enviado.
 * Nenhum GA4/Pixel/TikTok/segment é instalado. Serve apenas como
 * ponto único de disparo para futura integração com um provider real.
 *
 * Em produção real, este service seria substituído por uma integração
 * com o provedor escolhido (server-side preferencialmente).
 */

const ENABLED_IN_DEV = true;

function track(name: CheckoutAnalyticsEventName, payload?: Record<string, unknown>): void {
  const event: CheckoutAnalyticsEvent = { name, payload };
  if (ENABLED_IN_DEV && import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.debug("[analytics:mock]", event.name, event.payload ?? {});
  }
}

export const analyticsService = {
  track,
};
