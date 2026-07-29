/* eslint-disable react-refresh/only-export-components */
import type { PublicCatalogProductType, PublicCatalogSort } from "@/services/publicCatalog";
import type { Subcategory } from "@/types";

export const productTypeOptions: Array<[PublicCatalogProductType, string]> = [
  ["ACCOUNT", "Conta"],
  ["VIRTUAL_CURRENCY", "Moeda virtual"],
  ["GIFT_CARD", "Gift card"],
  ["KEY", "Chave"],
  ["SKIN", "Skin"],
  ["ITEM", "Item"],
  ["SERVICE", "Serviço"],
  ["SUBSCRIPTION", "Assinatura"],
  ["GAME", "Jogo"],
  ["SOFTWARE", "Software"],
  ["OTHER", "Outro"],
];
export const sortOptions: Array<[PublicCatalogSort, string]> = [
  ["RECENT", "Mais recentes"],
  ["OLDEST", "Mais antigos"],
  ["TITLE_ASC", "Título: A–Z"],
  ["TITLE_DESC", "Título: Z–A"],
];

type Props = {
  subcategories: Subcategory[];
  subcategory?: string;
  productType?: PublicCatalogProductType;
  sort: PublicCatalogSort;
  onChange: (change: {
    subcategory?: string;
    productType?: PublicCatalogProductType;
    sort?: PublicCatalogSort;
  }) => void;
};
export function CategoryCatalogControls({
  subcategories,
  subcategory,
  productType,
  sort,
  onChange,
}: Props) {
  const select = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm";
  return (
    <aside
      className="space-y-4 rounded-xl border border-border p-4"
      aria-label="Filtros do catálogo"
    >
      <label className="block text-sm font-medium">
        Subcategoria
        <select
          className={`${select} mt-1`}
          value={subcategory ?? ""}
          onChange={(e) => onChange({ subcategory: e.target.value || undefined })}
        >
          <option value="">Todas</option>
          {subcategories.map((item) => (
            <option key={item.slug} value={item.slug}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm font-medium">
        Tipo de produto
        <select
          className={`${select} mt-1`}
          value={productType ?? ""}
          onChange={(e) =>
            onChange({
              productType: (e.target.value || undefined) as PublicCatalogProductType | undefined,
            })
          }
        >
          <option value="">Todos os tipos</option>
          {productTypeOptions.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm font-medium">
        Ordenar
        <select
          className={`${select} mt-1`}
          value={sort}
          onChange={(e) => onChange({ sort: e.target.value as PublicCatalogSort })}
        >
          {sortOptions.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
    </aside>
  );
}
