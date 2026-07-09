import { products } from "@/data/products";
import { sellers, sellersList } from "@/data/sellers";
import type { Product, Seller, SellerReview } from "@/types";

/**
 * Mock service layer para vendedores.
 * Nenhuma página deve ler `@/data/sellers` diretamente — sempre passar por aqui.
 * As assinaturas foram desenhadas para serem substituíveis por chamadas HTTP/Supabase
 * sem alterar componentes consumidores.
 */

const delay = <T,>(data: T, ms = 220): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(data), ms));

function findSeller(idOrSlug: string): Seller | undefined {
  return sellersList.find((s) => s.slug === idOrSlug || s.id === idOrSlug);
}

const REVIEW_AUTHORS = [
  "Lucas M.", "Amanda R.", "Diego S.", "Renata C.", "Bruno F.",
  "Isabela T.", "Rafael G.", "Camila P.", "Pedro L.", "Marina K.",
];

const REVIEW_COMMENTS = [
  "Vendedor excelente, tudo entregue rapidinho.",
  "Já é minha quarta compra na loja. Nunca me decepcionou.",
  "Atendimento nota 10, tirou todas as minhas dúvidas no chat.",
  "Chegou em minutos, exatamente como anunciado.",
  "Confiança total. Recomendo para quem tem receio de comprar online.",
  "Preço justo e produto original. Voltarei a comprar.",
  "Loja séria, entrega instantânea funcionando perfeitamente.",
  "Suporte respondeu no fim de semana. Impressionante.",
];

function generateSellerReviews(seller: Seller, count: number): SellerReview[] {
  const sellerProducts = products.filter((p) => p.seller?.id === seller.id);
  const out: SellerReview[] = [];
  for (let i = 0; i < count; i++) {
    const seed = seller.id.charCodeAt(seller.id.length - 1) + i * 3;
    const rating = Math.min(5, 4 + ((seed % 3) === 0 ? 1 : 0.5 * ((seed % 2) + 1)));
    const date = new Date(Date.now() - (i + 1) * 86400000 * 2).toISOString();
    const relatedProduct = sellerProducts[i % Math.max(1, sellerProducts.length)];
    out.push({
      id: `${seller.id}-r${i}`,
      sellerId: seller.id,
      author: REVIEW_AUTHORS[(seed + i) % REVIEW_AUTHORS.length],
      avatarUrl: `https://i.pravatar.cc/64?u=${seller.id}-${i}`,
      rating,
      comment: REVIEW_COMMENTS[(seed + i) % REVIEW_COMMENTS.length],
      date,
      productTitle: relatedProduct?.title,
    });
  }
  return out;
}

export const sellerService = {
  list: (): Promise<Seller[]> => delay(sellersList),

  getSellerBySlug: (slug: string): Promise<Seller | undefined> =>
    delay(findSeller(slug)),

  getSellerById: (id: string): Promise<Seller | undefined> =>
    delay(findSeller(id)),

  getSellerProducts: (sellerId: string): Promise<Product[]> =>
    delay(products.filter((p) => p.seller?.id === sellerId)),

  getSellerReviews: (sellerId: string, limit = 8): Promise<SellerReview[]> => {
    const seller = findSeller(sellerId);
    if (!seller) return delay([]);
    return delay(generateSellerReviews(seller, limit));
  },
};

/** Re-export utilitário — legado. */
export function resolveSellerSlug(seller: Seller | undefined): string | undefined {
  if (!seller) return undefined;
  return seller.slug ?? sellers[seller.id]?.slug;
}
