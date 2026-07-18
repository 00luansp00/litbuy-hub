import { HttpStatus, ServiceUnavailableException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  AuthMailer,
  DisabledAuthSmsPort,
  ExternalUnavailableAuthSmsPort,
  MemoryAuthSmsPort,
  ResendAuthEmailAdapter,
  TwilioAuthSmsAdapter,
} from './auth.service';
import type { AuthSmsPort } from './auth.service';
import { AppError } from '../common/errors/app-error';

function smsProviderFactory(
  memory: MemoryAuthSmsPort,
  disabled: DisabledAuthSmsPort,
  external: ExternalUnavailableAuthSmsPort,
  twilio = new TwilioAuthSmsAdapter(),
): AuthSmsPort {
  const mode = process.env.AUTH_SMS_DELIVERY_MODE ?? 'disabled';
  if (mode === 'memory') return memory;
  if (mode === 'external') return process.env.AUTH_SMS_PROVIDER === 'twilio' ? twilio : external;
  return disabled;
}

describe('auth delivery providers', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('allows memory delivery only in controlled test mode without logging or returning codes', async () => {
    process.env.NODE_ENV = 'test';
    process.env.AUTH_EMAIL_DELIVERY_MODE = 'memory';
    process.env.AUTH_SMS_DELIVERY_MODE = 'memory';
    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthMailer,
        MemoryAuthSmsPort,
        DisabledAuthSmsPort,
        ExternalUnavailableAuthSmsPort,
        TwilioAuthSmsAdapter,
        {
          provide: 'AuthSmsPort',
          useFactory: smsProviderFactory,
          inject: [
            MemoryAuthSmsPort,
            DisabledAuthSmsPort,
            ExternalUnavailableAuthSmsPort,
            TwilioAuthSmsAdapter,
          ],
        },
      ],
    }).compile();
    const mailer = moduleRef.get(AuthMailer);
    const sms = moduleRef.get(MemoryAuthSmsPort);

    expect(
      await mailer.send('person@example.test', 'EMAIL_VERIFICATION', 'opaque-token'),
    ).toBeUndefined();
    expect(await sms.send('+5511999999999', 'TWO_FACTOR_CODE', '123456')).toBeUndefined();
    expect(mailer.sent).toEqual([
      { to: 'person@example.test', purpose: 'EMAIL_VERIFICATION', token: 'opaque-token' },
    ]);
    expect(sms.sent).toEqual([
      { to: '+5511999999999', purpose: 'TWO_FACTOR_CODE', code: '123456' },
    ]);
    await moduleRef.close();
  });

  it('allows memory email delivery in controlled development mode', async () => {
    process.env.NODE_ENV = 'development';
    process.env.AUTH_EMAIL_DELIVERY_MODE = 'memory';
    const mailer = new AuthMailer();

    expect(
      await mailer.send('dev@example.test', 'EMAIL_VERIFICATION', 'dev-token'),
    ).toBeUndefined();
    expect(mailer.sent).toEqual([
      { to: 'dev@example.test', purpose: 'EMAIL_VERIFICATION', token: 'dev-token' },
    ]);
  });

  it('rejects memory email delivery outside development and test', async () => {
    process.env.NODE_ENV = 'local-rehearsal';
    process.env.AUTH_EMAIL_DELIVERY_MODE = 'memory';
    const mailer = new AuthMailer();

    await expect(
      mailer.send('person@example.test', 'PASSWORD_RESET', 'opaque-token'),
    ).rejects.toThrow(AppError);
    expect(mailer.sent).toEqual([]);
  });

  it('disabled email is explicit failure and does not store tokens', async () => {
    process.env.NODE_ENV = 'test';
    process.env.AUTH_EMAIL_DELIVERY_MODE = 'disabled';
    const mailer = new AuthMailer();

    await expect(
      mailer.send('person@example.test', 'PASSWORD_RESET', 'opaque-token'),
    ).rejects.toThrow(AppError);
    try {
      await mailer.send('person@example.test', 'PASSWORD_RESET', 'opaque-token');
    } catch (error) {
      expect(error).toMatchObject({
        code: 'EMAIL_DELIVERY_UNAVAILABLE',
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
      });
    }
    expect(mailer.sent).toEqual([]);
  });

  it('external email is explicit failure and not a no-op', async () => {
    process.env.NODE_ENV = 'test';
    process.env.AUTH_EMAIL_DELIVERY_MODE = 'external';
    const mailer = new AuthMailer();

    await expect(
      mailer.send('person@example.test', 'PASSWORD_RESET', 'opaque-token'),
    ).rejects.toThrow(AppError);
    expect(mailer.sent).toEqual([]);
  });

  it('unknown email mode fails closed without storing tokens', async () => {
    process.env.NODE_ENV = 'test';
    process.env.AUTH_EMAIL_DELIVERY_MODE = 'unexpected-mode';
    const mailer = new AuthMailer();

    await expect(
      mailer.send('person@example.test', 'PASSWORD_RESET', 'opaque-token'),
    ).rejects.toThrow(AppError);
    expect(mailer.sent).toEqual([]);
  });

  it('does not write email tokens or codes to console output', async () => {
    process.env.NODE_ENV = 'test';
    process.env.AUTH_EMAIL_DELIVERY_MODE = 'memory';
    const spies = [
      jest.spyOn(console, 'log').mockImplementation(() => undefined),
      jest.spyOn(console, 'info').mockImplementation(() => undefined),
      jest.spyOn(console, 'warn').mockImplementation(() => undefined),
      jest.spyOn(console, 'error').mockImplementation(() => undefined),
    ];
    const mailer = new AuthMailer();

    try {
      await mailer.send('person@example.test', 'EMAIL_VERIFICATION', 'sensitive-token');
      process.env.AUTH_EMAIL_DELIVERY_MODE = 'disabled';
      await expect(mailer.send('person@example.test', 'TWO_FACTOR_CODE', '123456')).rejects.toThrow(
        AppError,
      );
      const consolePayload = spies
        .flatMap((spy) => spy.mock.calls)
        .flat()
        .join(' ');
      expect(consolePayload).not.toContain('sensitive-token');
      expect(consolePayload).not.toContain('123456');
      for (const spy of spies) expect(spy).not.toHaveBeenCalled();
    } finally {
      for (const spy of spies) spy.mockRestore();
    }
  });

  it('external SMS never resolves to the memory adapter', async () => {
    process.env.NODE_ENV = 'test';
    process.env.AUTH_SMS_DELIVERY_MODE = 'external';
    const moduleRef = await Test.createTestingModule({
      providers: [
        MemoryAuthSmsPort,
        DisabledAuthSmsPort,
        ExternalUnavailableAuthSmsPort,
        TwilioAuthSmsAdapter,
        {
          provide: 'AuthSmsPort',
          useFactory: smsProviderFactory,
          inject: [
            MemoryAuthSmsPort,
            DisabledAuthSmsPort,
            ExternalUnavailableAuthSmsPort,
            TwilioAuthSmsAdapter,
          ],
        },
      ],
    }).compile();
    const sms = moduleRef.get<AuthSmsPort>('AuthSmsPort');

    expect(sms).not.toBeInstanceOf(MemoryAuthSmsPort);
    await expect(sms.send('+5511999999999', 'TWO_FACTOR_CODE', '123456')).rejects.toThrow(AppError);
    try {
      await sms.send('+5511999999999', 'TWO_FACTOR_CODE', '123456');
    } catch (error) {
      expect(error).toMatchObject({
        code: 'SMS_DELIVERY_UNAVAILABLE',
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
      });
    }
    await moduleRef.close();
  });

  it('external unavailable SMS fallback fails on send but does not throw on bootstrap by itself', async () => {
    process.env.NODE_ENV = 'staging';
    process.env.AUTH_SMS_DELIVERY_MODE = 'external';

    const fallback = new ExternalUnavailableAuthSmsPort();

    await expect(fallback.send('+5511999999999', 'TWO_FACTOR_CODE', '123456')).rejects.toThrow(
      AppError,
    );
  });

  it('production rejects memory providers on module init', () => {
    process.env.NODE_ENV = 'production';
    process.env.AUTH_EMAIL_DELIVERY_MODE = 'memory';
    process.env.AUTH_SMS_DELIVERY_MODE = 'memory';

    expect(() => new AuthMailer().onModuleInit()).toThrow(ServiceUnavailableException);
    expect(() => new MemoryAuthSmsPort().onModuleInit()).toThrow(ServiceUnavailableException);
  });

  describe('staging external provider bootstrap', () => {
    const validExternalEnv = {
      NODE_ENV: 'staging',
      AUTH_EMAIL_DELIVERY_MODE: 'external',
      AUTH_EMAIL_PROVIDER: 'resend',
      RESEND_API_KEY: 're_live_configured_secret',
      RESEND_FROM_EMAIL: 'auth@litbuy.invalid',
      RESEND_FROM_NAME: 'LIT Buy',
      AUTH_SMS_DELIVERY_MODE: 'external',
      AUTH_SMS_PROVIDER: 'twilio',
      TWILIO_ACCOUNT_SID: 'AC1234567890abcdef',
      TWILIO_AUTH_TOKEN: 'twilio_configured_secret',
      TWILIO_MESSAGING_SERVICE_SID: 'MG1234567890abcdef',
      TWILIO_FROM_NUMBER: '',
    };

    async function compileDeliveryModule() {
      return Test.createTestingModule({
        providers: [
          AuthMailer,
          ResendAuthEmailAdapter,
          MemoryAuthSmsPort,
          DisabledAuthSmsPort,
          ExternalUnavailableAuthSmsPort,
          TwilioAuthSmsAdapter,
          {
            provide: 'AuthSmsPort',
            useFactory: smsProviderFactory,
            inject: [
              MemoryAuthSmsPort,
              DisabledAuthSmsPort,
              ExternalUnavailableAuthSmsPort,
              TwilioAuthSmsAdapter,
            ],
          },
        ],
      }).compile();
    }

    beforeEach(() => {
      Object.assign(process.env, validExternalEnv);
    });

    it('initializes staging with Resend and Twilio without fallback bootstrap failure', async () => {
      const moduleRef = await compileDeliveryModule();
      await expect(moduleRef.init()).resolves.toBeDefined();

      expect(moduleRef.get<AuthSmsPort>('AuthSmsPort')).toBeInstanceOf(TwilioAuthSmsAdapter);
      await moduleRef.close();
    });

    it('uses the injected Resend adapter instead of direct construction', async () => {
      const injected = {
        send: jest
          .fn<Promise<void>, Parameters<ResendAuthEmailAdapter['send']>>()
          .mockResolvedValue(undefined),
      };
      const moduleRef = await Test.createTestingModule({
        providers: [{ provide: ResendAuthEmailAdapter, useValue: injected }, AuthMailer],
      }).compile();
      const mailer = moduleRef.get(AuthMailer);

      await mailer.send('person@example.test', 'PASSWORD_RESET', 'opaque-token');

      expect(injected.send).toHaveBeenCalledWith(
        'person@example.test',
        'PASSWORD_RESET',
        'opaque-token',
      );
      await moduleRef.close();
    });

    it.each([
      ['missing Twilio provider', { AUTH_SMS_PROVIDER: '' }],
      ['unknown Twilio provider', { AUTH_SMS_PROVIDER: 'unknown' }],
      ['incomplete Twilio credentials', { TWILIO_AUTH_TOKEN: '' }],
      ['staging memory', { AUTH_SMS_DELIVERY_MODE: 'memory' }],
    ])('fails closed for %s', async (_caseName, overrides) => {
      Object.assign(process.env, overrides);
      await expect(async () => {
        const moduleRef = await compileDeliveryModule();
        try {
          await moduleRef.init();
        } finally {
          await moduleRef.close();
        }
      }).rejects.toThrow(ServiceUnavailableException);
    });
  });
});
