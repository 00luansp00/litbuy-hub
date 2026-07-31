/* eslint-disable react-refresh/only-export-components */
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { BuyerOrder } from "@/services/orders";

export const makeOrder = (overrides: Partial<BuyerOrder> = {}): BuyerOrder => ({
  orderCode: "LIT-23456789ABCDEF",
  seller: { slug: "seller-historico", storeName: "Seller Histórico" },
  currency: "BRL",
  subtotalAmountMinor: "900719925474099312345",
  discountAmountMinor: "0",
  platformFeeAmountMinor: "100",
  totalAmountMinor: "900719925474099312445",
  status: "PENDING_PAYMENT",
  paymentStatus: "NOT_CREATED",
  fulfillmentStatus: "NOT_AVAILABLE",
  disputeStatus: "NONE",
  version: 1,
  expiresAt: "2026-08-01T00:00:00.000Z",
  cancelledAt: null,
  expiredAt: null,
  createdAt: "2026-07-31T00:00:00.000Z",
  updatedAt: "2026-07-31T00:00:00.000Z",
  items: [
    {
      productSlug: "produto-historico",
      productTitle: "Produto histórico",
      variantTitle: "Variante histórica",
      productType: "DIGITAL",
      productModel: "UNIT",
      deliveryMode: "MANUAL",
      quantity: 1,
      unitAmountMinor: "900719925474099312445",
      lineTotalAmountMinor: "900719925474099312445",
      currency: "BRL",
      serviceEstimatedDelivery: "3 dias úteis",
      serviceBuyerRequirements: "Briefing histórico",
    },
  ],
  ...overrides,
});

export function QueryWrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

export function pending<T>(): Promise<T> {
  return new Promise(() => undefined);
}
