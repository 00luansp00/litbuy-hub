import { Breadcrumb } from "@/components/common/Breadcrumb";
import { formatPublicCatalogPrice } from "@/components/public-catalog/formatPublicCatalogPrice";
import type { PublicCatalogProductDetail } from "@/services/publicCatalog";
import { PublicProductDetailGallery } from "./PublicProductDetailGallery";
import { PublicProductPurchasePanel } from "./PublicProductPurchasePanel";

const typeLabels: Record<PublicCatalogProductDetail["productType"], string> = {
  ACCOUNT: "Conta",
  VIRTUAL_CURRENCY: "Moeda virtual",
  GIFT_CARD: "Gift card",
  KEY: "Chave",
  SKIN: "Skin",
  ITEM: "Item",
  SERVICE: "Serviço",
  SUBSCRIPTION: "Assinatura",
  GAME: "Jogo",
  SOFTWARE: "Software",
  OTHER: "Outro",
};
const modelLabels = { NORMAL: "Normal", DYNAMIC: "Dinâmico", SERVICE: "Serviço" } as const;
const money = (value: string) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value));

export function PublicProductDetailContent({ product }: { product: PublicCatalogProductDetail }) {
  const showServiceVariants = product.model === "SERVICE" && product.variants.length > 0;
  return (
    <main className="container-lit space-y-8 py-6 md:py-10">
      <Breadcrumb
        items={[
          { label: "Home", to: "/" },
          {
            label: product.category.name,
            to: "/categoria/$slug",
            params: { slug: product.category.slug },
          },
          ...(product.subcategory
            ? [
                {
                  label: product.subcategory.name,
                  to: "/categoria/$slug",
                  params: { slug: product.category.slug },
                  search: { subcategory: product.subcategory.slug },
                },
              ]
            : []),
          { label: product.title },
        ]}
      />
      <div className="grid gap-8 lg:grid-cols-2">
        <PublicProductDetailGallery product={product} />
        <section className="space-y-6">
          <div>
            <p className="text-sm text-muted-foreground">
              {product.category.name}
              {product.subcategory ? ` · ${product.subcategory.name}` : ""}
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">{product.title}</h1>
            <p className="mt-3 text-3xl font-bold text-primary">
              {formatPublicCatalogPrice(product.pricing)}
            </p>
          </div>
          <dl className="grid grid-cols-2 gap-3 rounded-2xl border bg-card p-5 text-sm">
            <div>
              <dt className="text-muted-foreground">Tipo</dt>
              <dd className="font-medium">{typeLabels[product.productType]}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Modelo</dt>
              <dd className="font-medium">{modelLabels[product.model]}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Estoque</dt>
              <dd className="font-medium">
                {product.stock === null ? "Não aplicável" : product.stock}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Modo de entrega informado</dt>
              <dd className="font-medium">
                {product.deliveryMode === "MANUAL" ? "Entrega manual" : "Entrega automática"}
              </dd>
            </div>
          </dl>
          <PublicProductPurchasePanel product={product} />
          <section className="rounded-2xl border bg-card p-5">
            <h2 className="font-semibold">Sobre a loja</h2>
            <p className="mt-2">{product.seller.storeName}</p>
            <p className="text-sm text-muted-foreground">{product.seller.slug}</p>
          </section>
          <div className="rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
            <p>Este anúncio é carregado diretamente do catálogo público da LIT Buy.</p>
            <p>Pagamento e comunicação com o vendedor serão conectados em etapas posteriores.</p>
          </div>
        </section>
      </div>
      <section className="rounded-2xl border bg-card p-6">
        <h2 className="text-xl font-semibold">Descrição</h2>
        <p className="mt-4 whitespace-pre-wrap leading-7 text-muted-foreground">
          {product.description}
        </p>
      </section>
      {showServiceVariants && (
        <section>
          <h2 className="text-xl font-semibold">Formatos do serviço</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {product.variants.map((variant) => (
              <article key={variant.id} className="rounded-xl border bg-card p-5">
                <h3 className="font-semibold">{variant.title}</h3>
                {variant.description && (
                  <p className="mt-2 text-sm text-muted-foreground">{variant.description}</p>
                )}
                <p className="mt-3 font-bold text-primary">{money(variant.price)}</p>
                <p className="text-sm text-muted-foreground">Estoque: {variant.stock}</p>
              </article>
            ))}
          </div>
        </section>
      )}
      {product.serviceDetails && (
        <section className="rounded-2xl border bg-card p-6">
          <h2 className="text-xl font-semibold">Detalhes do serviço</h2>
          <dl className="mt-4 space-y-2 text-sm">
            <div>
              <dt className="text-muted-foreground">Tipo de preço</dt>
              <dd>
                {product.serviceDetails.pricingType === "FIXED" ? "Preço fixo" : "Sob orçamento"}
              </dd>
            </div>
            {product.serviceDetails.pricingType === "FIXED" && (
              <div>
                <dt className="text-muted-foreground">Preço base</dt>
                <dd>{money(product.serviceDetails.basePrice)}</dd>
              </div>
            )}
            <div>
              <dt className="text-muted-foreground">Prazo estimado de entrega</dt>
              <dd>{product.serviceDetails.estimatedDelivery}</dd>
            </div>
          </dl>
        </section>
      )}
    </main>
  );
}
