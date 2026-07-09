export const formatBRL = (value: number): string =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);

export const formatCompact = (value: number): string =>
  new Intl.NumberFormat("pt-BR", { notation: "compact" }).format(value);
