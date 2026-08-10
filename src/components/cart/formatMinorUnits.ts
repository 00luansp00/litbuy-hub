export function formatBrlMinorUnits(minorUnits: string): string {
  if (!/^-?\d+$/.test(minorUnits)) return "Valor não disponível";

  const value = BigInt(minorUnits);
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  const cents = (absolute % 100n).toString().padStart(2, "0");
  const reais = (absolute / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");

  return `R$ ${negative ? "-" : ""}${reais},${cents}`;
}
