import { PlatformRole } from '@prisma/client';
import { parseRoleCommand } from './manage-roles';

describe('manage roles CLI parsing', () => {
  it('rejects invalid action and missing confirmation', () => {
    expect(() =>
      parseRoleCommand([
        'bad',
        '--role=ADMIN',
        '--user-id=11111111-1111-4111-8111-111111111111',
        '--confirm',
      ]),
    ).toThrow('INVALID_ACTION');
    expect(() =>
      parseRoleCommand(['grant', '--role=ADMIN', '--user-id=11111111-1111-4111-8111-111111111111']),
    ).toThrow('CONFIRMATION_REQUIRED');
  });

  it('rejects invalid role, invalid uuid, simultaneous identifiers and missing identifier', () => {
    expect(() =>
      parseRoleCommand([
        'grant',
        '--role=OWNER',
        '--user-id=11111111-1111-4111-8111-111111111111',
        '--confirm',
      ]),
    ).toThrow('INVALID_ROLE');
    expect(() => parseRoleCommand(['grant', '--role=ADMIN', '--user-id=bad', '--confirm'])).toThrow(
      'INVALID_USER_ID',
    );
    expect(() =>
      parseRoleCommand([
        'grant',
        '--role=ADMIN',
        '--user-id=11111111-1111-4111-8111-111111111111',
        '--email=a@b.com',
        '--confirm',
      ]),
    ).toThrow('EXACTLY_ONE_USER_IDENTIFIER_REQUIRED');
    expect(() => parseRoleCommand(['grant', '--role=ADMIN', '--confirm'])).toThrow(
      'EXACTLY_ONE_USER_IDENTIFIER_REQUIRED',
    );
  });

  it('normalizes email and accepts uuid operations', () => {
    expect(
      parseRoleCommand(['grant', '--role=SELLER', '--email= Test@Example.COM ', '--confirm']),
    ).toEqual({ action: 'grant', role: PlatformRole.SELLER, email: 'test@example.com' });
    expect(
      parseRoleCommand([
        'revoke',
        '--role=ADMIN',
        '--user-id=11111111-1111-4111-8111-111111111111',
        '--confirm',
      ]),
    ).toEqual({
      action: 'revoke',
      role: PlatformRole.ADMIN,
      userId: '11111111-1111-4111-8111-111111111111',
      email: undefined,
    });
  });

  it('blocks BUYER revocation during parsing', () => {
    expect(() =>
      parseRoleCommand([
        'revoke',
        '--role=BUYER',
        '--user-id=11111111-1111-4111-8111-111111111111',
        '--confirm',
      ]),
    ).toThrow('BUYER_ROLE_REVOKE_DISABLED');
  });

  it('safe output shape can omit personal identifiers', () => {
    const output = JSON.stringify({
      ok: true,
      action: 'grant',
      role: 'ADMIN',
      userId: '11111111-1111-4111-8111-111111111111',
      changed: false,
      result: 'unchanged',
    });
    expect(output).not.toMatch(/@|phone|token|password|credential/i);
  });
});
