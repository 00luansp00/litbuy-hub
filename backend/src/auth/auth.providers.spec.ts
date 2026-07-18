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

  it('external email is explicit failure and not a no-op', () => {
    process.env.NODE_ENV = 'test';
    process.env.AUTH_EMAIL_DELIVERY_MODE = 'external';
    const mailer = new AuthMailer();

    expect(() => mailer.send('person@example.test', 'PASSWORD_RESET', 'opaque-token')).toThrow(
      ServiceUnavailableException,
    );
    expect(mailer.sent).toEqual([]);
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

  it('production rejects memory providers on module init', () => {
    process.env.NODE_ENV = 'production';
    process.env.AUTH_EMAIL_DELIVERY_MODE = 'memory';
    process.env.AUTH_SMS_DELIVERY_MODE = 'memory';

    expect(() => new AuthMailer().onModuleInit()).toThrow(ServiceUnavailableException);
    expect(() => new MemoryAuthSmsPort().onModuleInit()).toThrow(ServiceUnavailableException);
  });
});
