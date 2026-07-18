export type TrustProxyConfig = false | number | string;

export function parseTrustProxy(value: string | undefined): TrustProxyConfig {
  const normalized = (value ?? 'false').trim();
  if (normalized === '' || normalized === 'false') return false;
  if (/^[1-9]\d*$/.test(normalized)) return Number(normalized);
  return normalized;
}
