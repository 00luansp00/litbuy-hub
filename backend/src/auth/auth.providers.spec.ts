import { HttpStatus, ServiceUnavailableException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  AuthMailer,
  DisabledAuthSmsPort,
  ExternalUnavailableAuthSmsPort,
  MemoryAuthSmsPort,
} from './auth.service';
import type { AuthSmsPort } from './auth.service';
import { AppError } from '../common/errors/app-error';

function smsProviderFactory(
  memory: MemoryAuthSmsPort,
  disabled: DisabledAuthSmsPort,
  external: ExternalUnavailableAuthSmsPort,
): AuthSmsPort {
  const mode = process.env.AUTH_SMS_DELIVERY_MODE ?? 'disabled';
  if (mode === 'memory') return memory;
  if (mode === 'external') return external;
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
        {
          provide: 'AuthSmsPort',
          useFactory: smsProviderFactory,
          inject: [MemoryAuthSmsPort, DisabledAuthSmsPort, ExternalUnavailableAuthSmsPort],
        },
      ],
    }).compile();
    const mailer = moduleRef.get(AuthMailer);
    const sms = moduleRef.get(MemoryAuthSmsPort);

    expect(
      mailer.send('person@example.test', 'EMAIL_VERIFICATION', 'opaque-token'),
    ).toBeUndefined();
    expect(sms.send('+5511999999999', 'TWO_FACTOR_CODE', '123456')).toBeUndefined();
    expect(mailer.sent).toEqual([
      { to: 'person@example.test', purpose: 'EMAIL_VERIFICATION', token: 'opaque-token' },
    ]);
    expect(sms.sent).toEqual([
      { to: '+5511999999999', purpose: 'TWO_FACTOR_CODE', code: '123456' },
    ]);
    await moduleRef.close();
  });

  it('allows memory email delivery in controlled development mode', () => {
    process.env.NODE_ENV = 'development';
    process.env.AUTH_EMAIL_DELIVERY_MODE = 'memory';
    const mailer = new AuthMailer();

    expect(mailer.send('dev@example.test', 'EMAIL_VERIFICATION', 'dev-token')).toBeUndefined();
    expect(mailer.sent).toEqual([
      { to: 'dev@example.test', purpose: 'EMAIL_VERIFICATION', token: 'dev-token' },
    ]);
  });

  it('rejects memory email delivery outside development and test', () => {
    process.env.NODE_ENV = 'local-rehearsal';
    process.env.AUTH_EMAIL_DELIVERY_MODE = 'memory';
    const mailer = new AuthMailer();

    expect(() => mailer.send('person@example.test', 'PASSWORD_RESET', 'opaque-token')).toThrow(
      AppError,
    );
    expect(mailer.sent).toEqual([]);
  });

  it('disabled email is explicit failure and does not store tokens', () => {
    process.env.NODE_ENV = 'test';
    process.env.AUTH_EMAIL_DELIVERY_MODE = 'disabled';
    const mailer = new AuthMailer();

    expect(() => mailer.send('person@example.test', 'PASSWORD_RESET', 'opaque-token')).toThrow(
      AppError,
    );
    try {
      mailer.send('person@example.test', 'PASSWORD_RESET', 'opaque-token');
    } catch (error) {
      expect(error).toMatchObject({
        code: 'EMAIL_DELIVERY_UNAVAILABLE',
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
      });
    }
    expect(mailer.sent).toEqual([]);
  });

  it('external email is explicit failure and not a no-op', () => {
    process.env.NODE_ENV = 'test';
    process.env.AUTH_EMAIL_DELIVERY_MODE = 'external';
    const mailer = new AuthMailer();

    expect(() => mailer.send('person@example.test', 'PASSWORD_RESET', 'opaque-token')).toThrow(
      AppError,
    );
    expect(mailer.sent).toEqual([]);
  });

  it('unknown email mode fails closed without storing tokens', () => {
    process.env.NODE_ENV = 'test';
    process.env.AUTH_EMAIL_DELIVERY_MODE = 'unexpected-mode';
    const mailer = new AuthMailer();

    expect(() => mailer.send('person@example.test', 'PASSWORD_RESET', 'opaque-token')).toThrow(
      AppError,
    );
    expect(mailer.sent).toEqual([]);
  });

  it('does not write email tokens or codes to console output', () => {
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
      mailer.send('person@example.test', 'EMAIL_VERIFICATION', 'sensitive-token');
      process.env.AUTH_EMAIL_DELIVERY_MODE = 'disabled';
      expect(() => mailer.send('person@example.test', 'TWO_FACTOR_CODE', '123456')).toThrow(
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
        {
          provide: 'AuthSmsPort',
          useFactory: smsProviderFactory,
          inject: [MemoryAuthSmsPort, DisabledAuthSmsPort, ExternalUnavailableAuthSmsPort],
        },
      ],
    }).compile();
    const sms = moduleRef.get<AuthSmsPort>('AuthSmsPort');

    expect(sms).not.toBeInstanceOf(MemoryAuthSmsPort);
    expect(() => sms.send('+5511999999999', 'TWO_FACTOR_CODE', '123456')).toThrow(AppError);
    try {
      sms.send('+5511999999999', 'TWO_FACTOR_CODE', '123456');
    } catch (error) {
      expect(error).toMatchObject({
        code: 'SMS_DELIVERY_UNAVAILABLE',
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
      });
    }
    await moduleRef.close();
  });

  it('staging and production external providers fail during module initialization', () => {
    for (const nodeEnv of ['staging', 'production']) {
      process.env.NODE_ENV = nodeEnv;
      process.env.AUTH_EMAIL_DELIVERY_MODE = 'external';
      process.env.AUTH_SMS_DELIVERY_MODE = 'external';

      expect(() => new AuthMailer().onModuleInit()).toThrow(ServiceUnavailableException);
      expect(() => new ExternalUnavailableAuthSmsPort().onModuleInit()).toThrow(
        ServiceUnavailableException,
      );
    }
  });

  it('production rejects memory providers on module init', () => {
    process.env.NODE_ENV = 'production';
    process.env.AUTH_EMAIL_DELIVERY_MODE = 'memory';
    process.env.AUTH_SMS_DELIVERY_MODE = 'memory';

    expect(() => new AuthMailer().onModuleInit()).toThrow(ServiceUnavailableException);
    expect(() => new MemoryAuthSmsPort().onModuleInit()).toThrow(ServiceUnavailableException);
  });
});
