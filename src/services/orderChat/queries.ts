import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/api/client";
import { OrderChatParseError } from "./parser";
import { orderChatService } from "./service";
import type { SendOrderChatMessage } from "./types";
export const ORDER_CHAT_PAGE_SIZE = 30;
export const ORDER_CHAT_POLL_INTERVAL = 5_000;
export const orderChatKeys = {
  all: ["order-chat"] as const,
  messages: (orderCode: string) => ["order-chat", orderCode, "messages"] as const,
};
const retry = (count: number, error: Error) =>
  !(error instanceof OrderChatParseError) &&
  !(error instanceof TypeError) &&
  !(error instanceof ApiError && [401, 403, 404, 409].includes(error.status)) &&
  count < 2;
export const useOrderChatMessages = (orderCode: string) =>
  useInfiniteQuery({
    queryKey: orderChatKeys.messages(orderCode),
    queryFn: ({ pageParam }) =>
      orderChatService.readMessages(orderCode, {
        cursor: pageParam ?? undefined,
        limit: ORDER_CHAT_PAGE_SIZE,
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    retry,
    refetchInterval: ORDER_CHAT_POLL_INTERVAL,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });
export const useSendOrderChatMessage = (orderCode: string) => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: SendOrderChatMessage) => orderChatService.sendMessage(orderCode, input),
    retry: false,
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: orderChatKeys.messages(orderCode) });
    },
  });
};
