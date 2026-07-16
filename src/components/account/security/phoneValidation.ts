export function isObviouslyBrazilianMobilePhone(value: string) {
  const digits = value.replace(/\D/g, "");
  const national = digits.length === 13 && digits.startsWith("55") ? digits.slice(2) : digits;
  return national.length === 11 && national[2] === "9";
}
