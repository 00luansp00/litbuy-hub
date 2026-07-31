import { useQuery } from "@tanstack/react-query";
import { ApiError } from "@/lib/api/client";
import { buyerOrdersService } from "./buyerOrdersService";
import type { OrderStatus } from "./types";
const retry = (count: number, error: Error) =>
  !(error instanceof ApiError && [401, 403, 404].includes(error.status)) && count < 2;
export const buyerOrderKeys = {
  all: ["buyer-orders"] as const,
  list: (page: number, limit: number, status?: OrderStatus) =>
    ["buyer-orders", page, limit, status ?? null] as const,
  detail: (code: string) => ["buyer-order", code] as const,
};
export const useBuyerOrders = (page: number, limit: number, status?: OrderStatus) =>
  useQuery({
    queryKey: buyerOrderKeys.list(page, limit, status),
    queryFn: () => buyerOrdersService.list({ page, limit, status }),
    retry,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
export const useBuyerOrder = (code: string) =>
  useQuery({
    queryKey: buyerOrderKeys.detail(code),
    queryFn: () => buyerOrdersService.detail(code),
    retry,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
