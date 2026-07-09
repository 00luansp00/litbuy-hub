import type { Review } from "@/types";

const AUTHORS = [
  "Lucas M.", "Amanda R.", "Diego S.", "Renata C.", "Bruno F.",
  "Isabela T.", "Rafael G.", "Camila P.", "Pedro L.", "Marina K.",
];

const COMMENTS = [
  "Entrega instantânea, exatamente como descrito. Recomendo!",
  "Vendedor super atencioso, tirou todas as minhas dúvidas.",
  "Produto ótimo, chegou em minutos. Voltarei a comprar.",
  "Melhor preço que encontrei. Muito satisfeito com a compra.",
  "Atendimento nota 10, produto original e sem problemas.",
  "Rápido, seguro e fácil. Só elogios.",
  "Já é minha terceira compra aqui. Sempre confiável.",
  "Muito bom, ainda que a entrega tenha demorado alguns minutos.",
];

/** Gera reviews determinísticos por productId. */
function generateReviews(productId: string, count: number): Review[] {
  const out: Review[] = [];
  for (let i = 0; i < count; i++) {
    const seed = productId.charCodeAt(productId.length - 1) + i;
    const rating = 4 + ((seed % 3) === 0 ? 1 : 0.5 * ((seed % 2) + 1));
    const date = new Date(Date.now() - (i + 1) * 86400000 * 3).toISOString();
    out.push({
      id: `${productId}-r${i}`,
      productId,
      author: AUTHORS[(seed + i) % AUTHORS.length],
      avatarUrl: `https://i.pravatar.cc/64?u=${productId}-${i}`,
      rating: Math.min(5, rating),
      comment: COMMENTS[(seed + i) % COMMENTS.length],
      date,
    });
  }
  return out;
}

const delay = <T,>(data: T, ms = 180): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(data), ms));

export const reviewService = {
  byProduct: (productId: string, limit = 6): Promise<Review[]> =>
    delay(generateReviews(productId, limit)),
};
