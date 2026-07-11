import { createFileRoute, notFound } from "@tanstack/react-router";
import { motion } from "motion/react";
import { Breadcrumb } from "@/components/common/Breadcrumb";
import { EmptyState } from "@/components/common/EmptyState";
import { ProductSkeleton } from "@/components/common/ProductSkeleton";
import { ContactSellerCard } from "@/components/seller/ContactSellerCard";
import { SellerAbout } from "@/components/seller/SellerAbout";
import { SellerBadges } from "@/components/seller/SellerBadges";
import { SellerHero } from "@/components/seller/SellerHero";
import { SellerProducts } from "@/components/seller/SellerProducts";
import { SellerReviews } from "@/components/seller/SellerReviews";
import { SellerStats } from "@/components/seller/SellerStats";
import { SellerLevelBadge } from "@/components/seller/SellerLevelBadge";
import { SellerVerificationBadge } from "@/components/verification/SellerVerificationBadge";
import { ReportButton } from "@/components/report/ReportButton";
import { sellerService } from "@/services/sellerService";


export const Route = createFileRoute("/loja/$slug")({
  loader: async ({ params }) => {
    const seller = await sellerService.getSellerBySlug(params.slug);
    if (!seller) throw notFound();
    const [products, reviews] = await Promise.all([
      sellerService.getSellerProducts(seller.id),
      sellerService.getSellerReviews(seller.id, 8),
    ]);
    return { seller, products, reviews };
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: `${loaderData.seller.name} — Loja no LIT Buy` },
          {
            name: "description",
            content:
              loaderData.seller.description ??
              `Confira os produtos, avaliações e reputação de ${loaderData.seller.name} no LIT Buy.`,
          },
          {
            property: "og:title",
            content: `${loaderData.seller.name} — Loja no LIT Buy`,
          },
        ]
      : [
          { title: "Loja não encontrada — LIT Buy" },
          { name: "robots", content: "noindex" },
        ],
  }),
  component: SellerPage,
  pendingComponent: SellerPending,
  notFoundComponent: SellerNotFound,
});

function SellerPage() {
  const { seller, products, reviews } = Route.useLoaderData();

  const average = reviews.length
    ? reviews.reduce((acc: number, r: { rating: number }) => acc + r.rating, 0) /
      reviews.length
    : seller.rating;
  const totalReviews = seller.stats?.totalReviews ?? reviews.length;

  return (
    <div className="container-lit space-y-8 py-6 md:py-10">
      <Breadcrumb
        items={[
          { label: "Home", to: "/" },
          { label: "Lojas" },
          { label: seller.name },
        ]}
      />

      <SellerHero seller={seller} />

      <div className="grid gap-6 lg:grid-cols-12 lg:gap-8">
        <div className="space-y-6 lg:col-span-8">
          {seller.stats && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.05 }}
            >
              <SellerStats stats={seller.stats} />
            </motion.div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <SellerLevelBadge sellerId={seller.id} />
            <SellerVerificationBadge sellerId={seller.id} />
          </div>

          <SellerAbout seller={seller} />


          {seller.badges && seller.badges.length > 0 && (
            <SellerBadges badges={seller.badges} />
          )}
        </div>

        <aside className="lg:col-span-4">
          <div className="lg:sticky lg:top-24 space-y-3">
            <ContactSellerCard seller={seller} />
            <div className="flex justify-end">
              <ReportButton
                targetType="seller"
                targetId={seller.id}
                targetLabel={seller.name}
                label="Reportar vendedor"
                variant="outline"
                size="sm"
                source="seller_page"
                context={{
                  sellerId: seller.id,
                  sellerSlug: seller.slug,
                }}
              />
            </div>
          </div>
        </aside>
      </div>

      <SellerProducts products={products} sellerName={seller.name} />

      <SellerReviews reviews={reviews} average={average} total={totalReviews} />
    </div>
  );
}

function SellerPending() {
  return (
    <div className="container-lit space-y-6 py-6 md:py-10">
      <div className="h-4 w-64 animate-pulse rounded bg-surface" />
      <div className="h-56 w-full animate-pulse rounded-2xl bg-surface" />
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-8">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-xl bg-surface" />
            ))}
          </div>
          <div className="h-40 animate-pulse rounded-2xl bg-surface" />
          <div className="h-40 animate-pulse rounded-2xl bg-surface" />
        </div>
        <div className="h-96 animate-pulse rounded-2xl bg-surface lg:col-span-4" />
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <ProductSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

function SellerNotFound() {
  return (
    <div className="container-lit py-16">
      <EmptyState
        icon="Store"
        title="Loja não encontrada"
        description="O perfil que você tentou acessar não existe ou foi removido."
        action={{ label: "Voltar para o início", to: "/" }}
      />
    </div>
  );
}
