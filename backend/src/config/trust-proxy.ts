import { isIP } from 'node:net';

export type TrustProxyConfig = false | number | string;

export const MAX_TRUST_PROXY_HOPS = 10;

const knownProxyNames = new Set(['loopback', 'linklocal', 'uniquelocal']);

export function parseTrustProxy(value: string | undefined): TrustProxyConfig {
  const normalized = (value ?? 'false').trim();
  if (normalized === '' || normalized === 'false') return false;
  if (/^[1-9]\d*$/.test(normalized)) return Number(normalized);
  return normalized;
}

export function isValidTrustProxy(value: string | undefined): boolean {
  if (typeof value !== 'string') return false;
  const normalized = value.trim();
  if (normalized === 'false') return true;
  if (/^[1-9]\d*$/.test(normalized)) {
    const hops = Number(normalized);
    return Number.isSafeInteger(hops) && hops <= MAX_TRUST_PROXY_HOPS;
  }
  if (
    normalized === '' ||
    normalized === 'true' ||
    normalized === '0' ||
    /^-\d+$/.test(normalized)
  ) {
    return false;
  }
  const entries = normalized.split(',').map((entry) => entry.trim());
  if (entries.length === 0 || entries.some((entry) => entry === '')) return false;
  return entries.every(isValidTrustProxyEntry);
}

function isValidTrustProxyEntry(entry: string): boolean {
  if (knownProxyNames.has(entry)) return true;
  if (isIP(entry) !== 0) return true;
  const [address, prefix, extra] = entry.split('/');
  if (extra !== undefined || prefix === undefined || address === '' || prefix === '') return false;
  const version = isIP(address);
  if (version === 0 || !/^\d+$/.test(prefix)) return false;
  const prefixNumber = Number(prefix);
  return prefixNumber >= 0 && prefixNumber <= (version === 4 ? 32 : 128);
}
