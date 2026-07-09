import { createFileRoute, notFound } from "@tanstack/react-router";
import { motion } from "motion/react";
import { Breadcrumb } from "@/components/common/Breadcrumb";
import { EmptyState } from "@/components/common/EmptyState";
import { ProductGrid } from "@/components/common/ProductGrid";
import { ProductSkeleton } from "@/components/common/ProductSkeleton";
import { SectionHeader } from "@/components/common/SectionHeader";
import { SellerInfo } from "@/components/common/SellerInfo";
import { ProductDescription } from "@/components/product/ProductDescription";
import { ProductGallery } from "@/components/product/ProductGallery";
import { ProductInfo } from "@/components/product/ProductInfo";
import { ProductReviews } from "@/components/product/ProductReviews";
import { PurchaseCard } from "@/components/product/PurchaseCard";
import { productService } from "@/services/productService";
import { reviewService } from "@/services/reviewService";

export const Route = createFileRoute("/produto/$id")({
  loader: async ({ params }) => {
    const product = await productService.byId(params.id);
    if (!product) throw notFound();
    const [related, reviews] = await Promise.all([
      productService.related(product.id, 8),
      reviewService.byProduct(product.id, 6),
    ]);
    return { product, related, reviews };
  },
  component: ProductPage,
  pendingComponent: ProductPending,
  notFoundComponent: ProductNotFound,
});

function ProductPage() {
  const { product, related, reviews } = Route.useLoaderData();

  // Galeria mockada — replica a imagem principal em variantes para simular múltiplas fotos.
  const gallery = [
    product.imageUrl,
    product.imageUrl.replace("/600/600", "/601/600"),
    product.imageUrl.replace("/600/600", "/600/601"),
    product.imageUrl.replace("/600/600", "/602/602"),
  ];

  const description =
    product.description ??
    `${product.title} — entrega ${product.instantDelivery ? "instantânea" : "rápida"} e vendedor ${product.verifiedSeller ? "verificado" : "avaliado"} pela LIT Buy.\n\nAntes da compra, verifique as informações e a reputação do anunciante. Todas as transações são protegidas pela nossa garantia da plataforma, com suporte dedicado em caso de qualquer problema.\n\nDúvidas? Envie uma mensagem diretamente ao vendedor pelo chat integrado (em breve).`;

  const seller =
    product.seller ??
    ({
      id: "seller-generic",
      name: "LIT Seller",
      avatarUrl: undefined,
      rating: 4.8,
      verified: true,
    } as const);

  const enrichedSeller = {
    ...seller,
    level: seller.verified ? "Top Seller" : "Vendedor",
    responseTime: "< 5 min",
    salesCount: seller.salesCount ?? Math.max(200, product.soldCount * 3),
    memberSince: seller.memberSince ?? "2022-04-01",
  };

  const avg =
    reviews.reduce((acc: number, r: { rating: number }) => acc + r.rating, 0) /
    Math.max(1, reviews.length);

  return (
    <div className="container-lit space-y-8 py-6 md:py-10">
      <Breadcrumb
        items={[
          { label: "Home", to: "/" },
          {
            label: product.categoryName,
            to: "/categoria/$slug",
            params: { slug: product.categorySlug },
          },
          { label: product.title },
        ]}
      />

      <div className="grid gap-6 lg:grid-cols-12 lg:gap-8">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="lg:col-span-5"
        >
          <ProductGallery images={gallery} alt={product.title} />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05 }}
          className="lg:col-span-4"
        >
          <ProductInfo product={product} />

          <div className="mt-6 rounded-2xl border border-border bg-card p-5">
            <h3 className="mb-3 text-sm font-semibold text-foreground">
              Sobre o vendedor
            </h3>
            <SellerInfo seller={enrichedSeller} size="lg" detailed />
          </div>
        </motion.div>

        <div className="lg:col-span-3">
          <div className="lg:sticky lg:top-24">
            <PurchaseCard product={product} />
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ProductDescription content={description} />
        <ProductReviews
          reviews={reviews}
          average={Number.isFinite(avg) ? avg : product.rating}
          total={product.reviewsCount}
        />
      </div>

      <section>
        <SectionHeader
          eyebrow="Você também pode gostar"
          title="Produtos relacionados"
          description="Outros anúncios na mesma categoria."
        />
        {related.length > 0 ? (
          <ProductGrid products={related} columns={4} />
        ) : (
          <EmptyState
            icon="PackageOpen"
            title="Sem produtos relacionados"
            description="Ainda não encontramos outros anúncios semelhantes."
          />
        )}
      </section>
    </div>
  );
}

function ProductPending() {
  return (
    <div className="container-lit space-y-6 py-6 md:py-10">
      <div className="h-4 w-64 animate-pulse rounded bg-surface" />
      <div className="grid gap-6 lg:grid-cols-12 lg:gap-8">
        <div className="aspect-square w-full animate-pulse rounded-2xl bg-surface lg:col-span-5" />
        <div className="space-y-4 lg:col-span-4">
          <div className="h-8 w-3/4 animate-pulse rounded bg-surface" />
          <div className="h-4 w-1/2 animate-pulse rounded bg-surface" />
          <div className="h-24 animate-pulse rounded-xl bg-surface" />
        </div>
        <div className="h-72 animate-pulse rounded-2xl bg-surface lg:col-span-3" />
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <ProductSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

function ProductNotFound() {
  return (
    <div className="container-lit py-16">
      <EmptyState
        icon="SearchX"
        title="Produto não encontrado"
        description="O anúncio que você tentou acessar não está mais disponível."
        action={{ label: "Voltar para o início", to: "/" }}
      />
    </div>
  );
}
