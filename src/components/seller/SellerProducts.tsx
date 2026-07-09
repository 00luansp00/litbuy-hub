import { ProductSection } from "@/components/home/ProductSection";
import type { Product } from "@/types";

interface SellerProductsProps {
  products: Product[];
  sellerName: string;
  loading?: boolean;
}

/**
 * SellerProducts — reaproveita ProductSection/ProductGrid/ProductCard.
 * Nenhum card novo é criado.
 */
export function SellerProducts({
  products,
  sellerName,
  loading = false,
}: SellerProductsProps) {
  return (
    <ProductSection
      eyebrow="Catálogo"
      title={`Produtos de ${sellerName}`}
      description="Todos os anúncios publicados por este vendedor no marketplace."
      products={products}
      columns={4}
      loading={loading}
    />
  );
}
