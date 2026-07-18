import { isValidTrustProxy, parseTrustProxy } from './trust-proxy';

describe('parseTrustProxy', () => {
  it('parses false, hop counts and explicit proxy lists for Express', () => {
    expect(parseTrustProxy('false')).toBe(false);
    expect(parseTrustProxy('1')).toBe(1);
    expect(parseTrustProxy('loopback, 10.0.0.0/8')).toBe('loopback, 10.0.0.0/8');
  });
});

describe('isValidTrustProxy', () => {
  it.each([
    'false',
    '1',
    '2',
    'loopback',
    'linklocal',
    'uniquelocal',
    '127.0.0.1',
    '10.0.0.0/8',
    '::1',
    '2001:db8::/32',
    'loopback, 10.0.0.0/8, 192.168.1.1',
  ])('accepts %s', (value) => expect(isValidTrustProxy(value)).toBe(true));

  it.each([
    '',
    'true',
    '0',
    '-1',
    'anything',
    'loopback,',
    '999.1.1.1',
    '10.0.0.0/33',
    '2001:db8::/129',
    '10.0.0.0/not-a-prefix',
  ])('rejects %s', (value) => expect(isValidTrustProxy(value)).toBe(false));
});
