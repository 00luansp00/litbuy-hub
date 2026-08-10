import { useMutation } from "@tanstack/react-query";
import { checkoutApiService, type CreateCheckoutSessionInput } from "./checkoutApiService";

const keys = new Map<string, string>();

export function checkoutIntentKey(
  sellerSlug: string,
  version: number,
  fingerprint: string,
): string {
  const intent = JSON.stringify([sellerSlug, version, fingerprint]);
  const existing = keys.get(intent);
  if (existing) return existing;
  const key = `checkout:${crypto.randomUUID()}`;
  keys.set(intent, key);
  return key;
}

export function useCreateCheckoutSession() {
  return useMutation({
    mutationFn: (input: CreateCheckoutSessionInput) =>
      checkoutApiService.createCheckoutSession(input),
    retry: false,
  });
}
