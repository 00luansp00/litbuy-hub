import { Module, ServiceUnavailableException } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { DatabaseModule } from '../database/database.module';
import { RedisModule } from '../redis/redis.module';
import { AppLogger } from '../common/logging/app-logger.service';
import { AuthController } from './auth.controller';
import {
  AuthMailer,
  AuthService,
  DisabledAuthSmsPort,
  ExternalUnavailableAuthSmsPort,
  MemoryAuthSmsPort,
  TwilioAuthSmsAdapter,
} from './auth.service';

@Module({
  imports: [DatabaseModule, RedisModule, JwtModule.register({})],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthMailer,
    MemoryAuthSmsPort,
    DisabledAuthSmsPort,
    ExternalUnavailableAuthSmsPort,
    TwilioAuthSmsAdapter,
    {
      provide: 'AuthSmsPort',
      useFactory: (
        memory: MemoryAuthSmsPort,
        disabled: DisabledAuthSmsPort,
        external: ExternalUnavailableAuthSmsPort,
        twilio: TwilioAuthSmsAdapter,
      ) => {
        const mode = process.env.AUTH_SMS_DELIVERY_MODE ?? 'disabled';
        if (mode === 'memory') {
          if (process.env.NODE_ENV === 'production') {
            throw new ServiceUnavailableException({ code: 'SMS_DELIVERY_UNAVAILABLE' });
          }
          return memory;
        }
        if (mode === 'external') {
          if (process.env.AUTH_SMS_PROVIDER === 'twilio') return twilio;
          return external;
        }
        if (mode === 'disabled') return disabled;
        throw new ServiceUnavailableException({ code: 'SMS_DELIVERY_UNAVAILABLE' });
      },
      inject: [
        MemoryAuthSmsPort,
        DisabledAuthSmsPort,
        ExternalUnavailableAuthSmsPort,
        TwilioAuthSmsAdapter,
      ],
    },
    AppLogger,
  ],
  exports: [AuthMailer, 'AuthSmsPort', MemoryAuthSmsPort],
})
export class AuthModule {}
