import { EventEmitter } from 'node:events';
import type { Request, Response } from 'express';
import { RequestLoggingMiddleware, normalizeRoute } from './request-logging.middleware';

describe('RequestLoggingMiddleware', () => {
  it('uses the recognized route when Express provides it', () => {
    expect(
      normalizeRoute({
        baseUrl: '/api/v1/auth',
        route: { path: '/sessions/:id' },
      } as unknown as Request),
    ).toBe('/api/v1/auth/sessions/:id');
  });

  it('normalizes dynamic fallback paths without query strings or secrets', () => {
    const route = normalizeRoute({
      path: '/api/v1/auth/sessions/550e8400-e29b-41d4-a716-446655440000/reset/token_abcdefghijklmnopqrstuvwxyz?code=secret',
      originalUrl:
        '/api/v1/auth/sessions/550e8400-e29b-41d4-a716-446655440000/reset/token_abcdefghijklmnopqrstuvwxyz?code=secret',
      url: '/api/v1/auth/sessions/550e8400-e29b-41d4-a716-446655440000/reset/token_abcdefghijklmnopqrstuvwxyz?code=secret',
    } as unknown as Request);
    expect(route).toBe('/api/v1/auth/sessions/:id/reset/:token');
    expect(route).not.toContain('550e8400');
    expect(route).not.toContain('secret');
  });

  it('logs request metadata with redacted headers and without body', () => {
    const logMock = jest.fn<void, [unknown]>();
    const logger = { log: logMock };
    const middleware = new RequestLoggingMiddleware(logger as never);
    const res = new EventEmitter() as Response & EventEmitter;
    res.statusCode = 204;
    const req = {
      requestId: 'req_123',
      method: 'POST',
      baseUrl: '/api/v1/auth',
      route: { path: '/sessions/:id' },
      path: '/api/v1/auth/sessions/550e8400-e29b-41d4-a716-446655440000?token=secret',
      headers: {
        authorization: 'Bearer secret-token',
        cookie: 'litbuy_refresh=secret-cookie',
        'x-csrf-token': 'secret-csrf',
      },
      body: { password: 'secret-password' },
    } as unknown as Request;

    middleware.use(req, res, jest.fn());
    res.emit('finish');

    expect(logMock).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'http_request',
        requestId: 'req_123',
        method: 'POST',
        route: '/api/v1/auth/sessions/:id',
        status: 204,
        environment: expect.any(String) as string,
        durationMs: expect.any(Number) as number,
      }),
    );
    const firstCall = logMock.mock.calls[0];
    expect(firstCall).toBeDefined();
    const payload = JSON.stringify(firstCall?.[0]);
    expect(payload).not.toContain('550e8400');
    expect(payload).not.toContain('secret-token');
    expect(payload).not.toContain('secret-cookie');
    expect(payload).not.toContain('secret-csrf');
    expect(payload).not.toContain('secret-password');
  });
});
