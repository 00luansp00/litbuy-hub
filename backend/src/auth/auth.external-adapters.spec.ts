import { HttpStatus } from '@nestjs/common';
import { AppError } from '../common/errors/app-error';
import { ResendAuthEmailAdapter, TwilioAuthSmsAdapter } from './auth.service';

type FetchMock = jest.Mock<Promise<Response>, [RequestInfo | URL, RequestInit?]>;

function okResponse(ok: boolean): Response {
  return { ok } as Response;
}

function requestBody(init: RequestInit | undefined): string {
  const body = init?.body;
  if (typeof body === 'string') return body;
  if (body instanceof URLSearchParams) return body.toString();
  return '';
}

describe('external auth delivery adapters', () => {
  const originalEnv = { ...process.env };
  const originalFetch = global.fetch;

  afterEach(() => {
    process.env = { ...originalEnv };
    global.fetch = originalFetch;
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('sends Resend email with sanitized idempotency and template content', async () => {
    process.env.AUTH_EMAIL_PROVIDER = 'resend';
    process.env.RESEND_API_KEY = 'resend_secret_key';
    process.env.RESEND_FROM_EMAIL = 'auth@litbuy.example';
    process.env.RESEND_FROM_NAME = 'LIT Buy';
    const fetchMock: FetchMock = jest
      .fn<Promise<Response>, [RequestInfo | URL, RequestInit?]>()
      .mockResolvedValue(okResponse(true));
    global.fetch = fetchMock;

    await new ResendAuthEmailAdapter().send(
      'person@example.test',
      'PASSWORD_RESET',
      'secret-token',
    );

    const init = fetchMock.mock.calls[0][1];
    const headers = init?.headers as Record<string, string>;
    expect(headers['Idempotency-Key']).toMatch(/^auth-/);
    expect(JSON.stringify(init?.headers)).not.toContain('secret-token');
    expect(JSON.stringify(init?.headers)).not.toContain('person@example.test');
    const body = JSON.parse(requestBody(init)) as { subject: string; html: string; text: string };
    expect(body.subject).toContain('LIT Buy');
    expect(body.html).toContain('/redefinir-senha');
    expect(body.text).toContain('Equipe LIT Buy');
  });

  it('maps Resend rejection, network errors, and missing config to existing code', async () => {
    process.env.AUTH_EMAIL_PROVIDER = 'resend';
    process.env.RESEND_API_KEY = 'resend_secret_key';
    process.env.RESEND_FROM_EMAIL = 'auth@litbuy.example';
    process.env.RESEND_FROM_NAME = 'LIT Buy';
    global.fetch = jest
      .fn<Promise<Response>, [RequestInfo | URL, RequestInit?]>()
      .mockResolvedValue(okResponse(false));
    await expect(
      new ResendAuthEmailAdapter().send('person@example.test', 'EMAIL_VERIFICATION', 't'),
    ).rejects.toMatchObject({
      code: 'EMAIL_DELIVERY_UNAVAILABLE',
      statusCode: HttpStatus.SERVICE_UNAVAILABLE,
    });
    global.fetch = jest
      .fn<Promise<Response>, [RequestInfo | URL, RequestInit?]>()
      .mockRejectedValue(new Error('network with secret-token'));
    await expect(
      new ResendAuthEmailAdapter().send('person@example.test', 'EMAIL_VERIFICATION', 't'),
    ).rejects.toBeInstanceOf(AppError);
    delete process.env.RESEND_API_KEY;
    await expect(
      new ResendAuthEmailAdapter().send('person@example.test', 'EMAIL_VERIFICATION', 't'),
    ).rejects.toBeInstanceOf(AppError);
  });

  it('sends Twilio SMS using messaging service or from number and rejects invalid input', async () => {
    process.env.AUTH_SMS_PROVIDER = 'twilio';
    process.env.TWILIO_ACCOUNT_SID = 'AC123456789';
    process.env.TWILIO_AUTH_TOKEN = 'twilio_secret';
    process.env.TWILIO_MESSAGING_SERVICE_SID = 'MG123456789';
    const fetchMock: FetchMock = jest
      .fn<Promise<Response>, [RequestInfo | URL, RequestInit?]>()
      .mockResolvedValue(okResponse(true));
    global.fetch = fetchMock;

    await new TwilioAuthSmsAdapter().send('+5511999999999', 'TWO_FACTOR_CODE', '123456');

    expect(requestBody(fetchMock.mock.calls[0][1])).toContain('MessagingServiceSid=MG123456789');
    expect(requestBody(fetchMock.mock.calls[0][1])).toContain('codigo+de+autenticacao');
    expect(JSON.stringify(fetchMock.mock.calls[0][1]?.headers)).not.toContain('twilio_secret');

    delete process.env.TWILIO_MESSAGING_SERVICE_SID;
    process.env.TWILIO_FROM_NUMBER = '+15551234567';
    await new TwilioAuthSmsAdapter().send('+5511999999999', 'PHONE_VERIFICATION', '654321');
    expect(requestBody(fetchMock.mock.calls[1][1])).toContain('From=%2B15551234567');

    await expect(
      new TwilioAuthSmsAdapter().send('11999999999', 'TWO_FACTOR_CODE', '123456'),
    ).rejects.toMatchObject({ code: 'SMS_DELIVERY_UNAVAILABLE' });
  });

  it('maps Twilio failures without console output', async () => {
    process.env.AUTH_SMS_PROVIDER = 'twilio';
    process.env.TWILIO_ACCOUNT_SID = 'AC123456789';
    process.env.TWILIO_AUTH_TOKEN = 'twilio_secret';
    process.env.TWILIO_FROM_NUMBER = '+15551234567';
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    global.fetch = jest
      .fn<Promise<Response>, [RequestInfo | URL, RequestInit?]>()
      .mockResolvedValue(okResponse(false));
    await expect(
      new TwilioAuthSmsAdapter().send('+5511999999999', 'TWO_FACTOR_CODE', '123456'),
    ).rejects.toMatchObject({ code: 'SMS_DELIVERY_UNAVAILABLE' });
    global.fetch = jest
      .fn<Promise<Response>, [RequestInfo | URL, RequestInit?]>()
      .mockRejectedValue(new Error('network +5511999999999 123456'));
    await expect(
      new TwilioAuthSmsAdapter().send('+5511999999999', 'TWO_FACTOR_CODE', '123456'),
    ).rejects.toBeInstanceOf(AppError);
    expect(consoleSpy).not.toHaveBeenCalled();
  });
});
