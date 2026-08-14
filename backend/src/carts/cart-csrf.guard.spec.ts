import type { ExecutionContext } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { CartCsrfGuard } from './cart-csrf.guard';
import { hmacToken } from '../auth/auth.utils';
import type { PrismaService } from '../database/prisma.service';

describe('CartCsrfGuard', () => {
  const csrfPepper = 'test-csrf-pepper';
  const token = 'session-bound-token';
  const sessionId = 'session-id';

  function setup(input: {
    cookie?: string;
    header?: string;
    session?: { csrfTokenHash: string } | null;
  }) {
    const request = {
      auth: { sessionId },
      cookies: input.cookie === undefined ? {} : { litbuy_csrf: input.cookie },
      headers: input.header === undefined ? {} : { 'x-csrf-token': input.header },
    };
    const config = {
      getOrThrow: jest.fn().mockReturnValue({ csrfCookieName: 'litbuy_csrf', csrfPepper }),
    } as unknown as ConfigService;
    const findUnique = jest.fn().mockResolvedValue(input.session ?? null);
    const prisma = { session: { findUnique } } as unknown as PrismaService;
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as ExecutionContext;
    return { guard: new CartCsrfGuard(config, prisma), context, findUnique };
  }

  it.each([
    ['missing cookie and header', undefined, undefined],
    ['missing cookie', undefined, token],
    ['missing header', token, undefined],
    ['mismatched cookie and header', token, 'different-token'],
  ])('rejects %s', async (_name, cookie, header) => {
    const { guard, context, findUnique } = setup({ cookie, header });

    await expect(guard.canActivate(context)).rejects.toMatchObject({
      response: { code: 'INVALID_CSRF' },
    });
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('rejects a matching cookie/header that is not bound to the session', async () => {
    const { guard, context } = setup({
      cookie: token,
      header: token,
      session: { csrfTokenHash: hmacToken('another-token', csrfPepper) },
    });

    await expect(guard.canActivate(context)).rejects.toMatchObject({
      response: { code: 'INVALID_CSRF' },
    });
  });

  it('allows a matching cookie/header bound to the authenticated session', async () => {
    const { guard, context, findUnique } = setup({
      cookie: token,
      header: token,
      session: { csrfTokenHash: hmacToken(token, csrfPepper) },
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(findUnique).toHaveBeenCalledWith({ where: { id: sessionId } });
  });
});
