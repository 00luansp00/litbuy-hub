import { formatBRL } from "@/lib/format";
import type { PublicCatalogPricing } from "@/services/publicCatalog";

export function formatPublicCatalogPrice(pricing: PublicCatalogPricing): string {
  if (pricing.kind === "QUOTE") return "Sob orçamento";
  const formatted = formatBRL(Number(pricing.amount));
  return pricing.kind === "FROM" ? `A partir de ${formatted}` : formatted;
}
