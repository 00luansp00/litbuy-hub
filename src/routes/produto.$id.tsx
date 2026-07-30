/* eslint-disable react-refresh/only-export-components */
import { createFileRoute, notFound, useRouter } from "@tanstack/react-router";
import { ApiError } from "@/lib/api/client";
import { publicCatalogService } from "@/services/publicCatalog";
import {
  PublicProductDetailContent,
  PublicProductDetailError,
  PublicProductDetailNotFound,
  PublicProductDetailSkeleton,
} from "@/components/public-product-detail";

export const retryPublicProductDetail = (invalidate: () => unknown): void => {
  void invalidate();
};

export const Route = createFileRoute("/produto/$id")({
  loader: async ({ params }) => {
    try {
      return { product: await publicCatalogService.detail(params.id), failed: false };
    } catch (error) {
      if (error instanceof TypeError && error.message === "INVALID_PUBLIC_CATALOG_SLUG")
        throw notFound();
      if (error instanceof ApiError && error.status === 404 && error.code === "PRODUCT_NOT_FOUND")
        throw notFound();
      return { product: null, failed: true };
    }
  },
  component: ProductPage,
  pendingComponent: PublicProductDetailSkeleton,
  notFoundComponent: PublicProductDetailNotFound,
});

function ProductPage() {
  const data = Route.useLoaderData();
  const router = useRouter();
  if (data.failed || !data.product)
    return (
      <PublicProductDetailError
        onRetry={() => retryPublicProductDetail(() => router.invalidate())}
      />
    );
  return <PublicProductDetailContent product={data.product} />;
}
