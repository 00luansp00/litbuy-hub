import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { DatabaseModule } from '../database/database.module';
import { RedisModule } from '../redis/redis.module';
import { AuthController } from './auth.controller';
import { AuthMailer, AuthService } from './auth.service';
@Module({
  imports: [DatabaseModule, RedisModule, JwtModule.register({})],
  controllers: [AuthController],
  providers: [AuthService, AuthMailer],
  exports: [AuthMailer],
})
export class AuthModule {}
