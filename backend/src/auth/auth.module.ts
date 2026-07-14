import { Module, ServiceUnavailableException } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { DatabaseModule } from '../database/database.module';
import { RedisModule } from '../redis/redis.module';
import { AppLogger } from '../common/logging/app-logger.service';
import { AuthController } from './auth.controller';
import { AuthMailer, AuthService, DisabledAuthSmsPort, MemoryAuthSmsPort } from './auth.service';

@Module({
  imports: [DatabaseModule, RedisModule, JwtModule.register({})],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthMailer,
    MemoryAuthSmsPort,
    DisabledAuthSmsPort,
    {
      provide: 'AuthSmsPort',
      useFactory: (memory: MemoryAuthSmsPort, disabled: DisabledAuthSmsPort) => {
        const mode = process.env.AUTH_SMS_DELIVERY_MODE ?? 'disabled';
        if (mode === 'memory') {
          if (process.env.NODE_ENV === 'production') {
            throw new ServiceUnavailableException({ code: 'SMS_DELIVERY_UNAVAILABLE' });
          }
          return memory;
        }
        if (mode === 'disabled') return disabled;
        throw new ServiceUnavailableException({ code: 'SMS_DELIVERY_UNAVAILABLE' });
      },
      inject: [MemoryAuthSmsPort, DisabledAuthSmsPort],
    },
    AppLogger,
  ],
  exports: [AuthMailer, 'AuthSmsPort', MemoryAuthSmsPort],
})
export class AuthModule {}
