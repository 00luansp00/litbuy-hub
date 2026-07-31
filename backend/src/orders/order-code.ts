import { randomBytes } from 'node:crypto';
const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
export function generateOrderCode(bytes: (size: number) => Buffer = randomBytes) {
  const entropy = bytes(14);
  let body = '';
  for (let i = 0; i < 14; i++) body += ALPHABET[entropy[i] % ALPHABET.length];
  return `LIT-${body}`;
}
