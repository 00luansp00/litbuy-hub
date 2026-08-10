import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/providers/AuthContext";
import {
  cartApiService,
  type AddCartItemInput,
  type BuyerCart,
  type RemoveCartItemInput,
  type UpdateCartItemInput,
} from "./cartApiService";

export const buyerCartKeys = {
  all: ["buyer-carts"] as const,
  lists: () => [...buyerCartKeys.all, "list"] as const,
  list: (page = 1, limit = 20) => [...buyerCartKeys.lists(), page, limit] as const,
  sellers: () => [...buyerCartKeys.all, "seller"] as const,
  seller: (sellerSlug: string) => [...buyerCartKeys.sellers(), sellerSlug] as const,
};

export function useBuyerCarts(page = 1, limit = 20) {
  const { status } = useAuth();
  return useQuery({
    queryKey: buyerCartKeys.list(page, limit),
    queryFn: () => cartApiService.listCarts(page, limit),
    enabled: status === "authenticated",
  });
}

export function useBuyerSellerCart(sellerSlug: string, enabled = true) {
  const { status } = useAuth();
  return useQuery({
    queryKey: buyerCartKeys.seller(sellerSlug),
    queryFn: () => cartApiService.getCart(sellerSlug),
    enabled: enabled && status === "authenticated" && sellerSlug.trim().length > 0,
  });
}

type AddCartItemVariables = { sellerSlug: string; input: AddCartItemInput };
type UpdateCartItemVariables = {
  sellerSlug: string;
  itemId: string;
  input: UpdateCartItemInput;
};
type RemoveCartItemVariables = {
  sellerSlug: string;
  itemId: string;
  input: RemoveCartItemInput;
};

function useAuthoritativeCartSuccess() {
  const queryClient = useQueryClient();
  return async (cart: BuyerCart, variables: { sellerSlug: string }) => {
    queryClient.setQueryData(buyerCartKeys.seller(variables.sellerSlug), cart);
    await queryClient.invalidateQueries({ queryKey: buyerCartKeys.lists() });
  };
}

export function useAddBuyerCartItem() {
  const onSuccess = useAuthoritativeCartSuccess();
  return useMutation({
    mutationFn: ({ sellerSlug, input }: AddCartItemVariables) =>
      cartApiService.addCartItem(sellerSlug, input),
    onSuccess,
    retry: false,
  });
}

export function useUpdateBuyerCartItem() {
  const onSuccess = useAuthoritativeCartSuccess();
  return useMutation({
    mutationFn: ({ sellerSlug, itemId, input }: UpdateCartItemVariables) =>
      cartApiService.updateCartItem(sellerSlug, itemId, input),
    onSuccess,
    retry: false,
  });
}

export function useRemoveBuyerCartItem() {
  const onSuccess = useAuthoritativeCartSuccess();
  return useMutation({
    mutationFn: ({ sellerSlug, itemId, input }: RemoveCartItemVariables) =>
      cartApiService.removeCartItem(sellerSlug, itemId, input),
    onSuccess,
    retry: false,
  });
}
