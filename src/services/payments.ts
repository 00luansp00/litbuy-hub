import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/client";
import { buyerOrderKeys } from "@/services/orders";
export type BuyerPayment = {
  orderCode: string;
  orderStatus: string;
  paymentStatus: string;
  attemptId: string | null;
  attemptNumber: number | null;
  providerCode: string | null;
  method: null;
  status: string | null;
  amountMinor: string;
  currency: string;
  alphaSimulationAvailable: boolean;
};
export type InitiationIntent = { attemptId: string | null; status: string | null };
export function createInitiationKeyManager(makeKey: () => string) {
  let active: { fingerprint: string; key: string } | undefined;
  return (intent: InitiationIntent) => {
    const fingerprint = `${intent.attemptId ?? "none"}:${intent.status ?? "none"}`;
    if (!active || active.fingerprint !== fingerprint) active = { fingerprint, key: makeKey() };
    return active.key;
  };
}
export const paymentKeys = { detail: (orderCode: string) => ["buyer-payment", orderCode] as const };
const request = (path: string, key: string) =>
  apiFetch<BuyerPayment>(path, { method: "POST", headers: { "Idempotency-Key": key }, body: "{}" });
export const paymentApi = {
  read: (code: string) => apiFetch<BuyerPayment>(`/orders/${encodeURIComponent(code)}/payment`),
  initiate: (code: string, key: string) =>
    request(`/orders/${encodeURIComponent(code)}/payment-attempts`, key),
  confirm: (code: string, attempt: string, key: string) =>
    request(
      `/orders/${encodeURIComponent(code)}/payment-attempts/${encodeURIComponent(attempt)}/alpha-confirm`,
      key,
    ),
};
export const useBuyerPayment = (code: string) =>
  useQuery({
    queryKey: paymentKeys.detail(code),
    queryFn: () => paymentApi.read(code),
    retry: false,
  });
export function usePaymentActions(code: string) {
  const client = useQueryClient();
  const refresh = async () => {
    await client.invalidateQueries({ queryKey: paymentKeys.detail(code) });
    await client.invalidateQueries({ queryKey: buyerOrderKeys.detail(code) });
    await client.invalidateQueries({ queryKey: buyerOrderKeys.all });
  };
  return {
    initiate: useMutation({
      mutationFn: ({ key }: { key: string }) => paymentApi.initiate(code, key),
      retry: false,
      onSuccess: refresh,
    }),
    confirm: useMutation({
      mutationFn: ({ attemptId, key }: { attemptId: string; key: string }) =>
        paymentApi.confirm(code, attemptId, key),
      retry: false,
      onSuccess: refresh,
    }),
  };
}
