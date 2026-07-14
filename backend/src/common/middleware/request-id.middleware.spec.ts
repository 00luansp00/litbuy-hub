import { RequestIdMiddleware, REQUEST_ID_HEADER } from './request-id.middleware';

describe('RequestIdMiddleware', () => {
  it('preserves an inbound request id', () => {
    const middleware = new RequestIdMiddleware();
    const req = { header: jest.fn().mockReturnValue('req-inbound') } as never;
    const setHeader = jest.fn();
    const next = jest.fn();

    middleware.use(req, { setHeader } as never, next);

    expect((req as { requestId: string }).requestId).toBe('req-inbound');
    expect(setHeader).toHaveBeenCalledWith(REQUEST_ID_HEADER, 'req-inbound');
    expect(next).toHaveBeenCalled();
  });
});
