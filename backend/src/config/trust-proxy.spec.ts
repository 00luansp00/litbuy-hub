import { parseTrustProxy } from './trust-proxy';

describe('parseTrustProxy', () => {
  it('parses false, hop counts and explicit proxy lists for Express', () => {
    expect(parseTrustProxy('false')).toBe(false);
    expect(parseTrustProxy('1')).toBe(1);
    expect(parseTrustProxy('loopback, 10.0.0.0/8')).toBe('loopback, 10.0.0.0/8');
  });
});
