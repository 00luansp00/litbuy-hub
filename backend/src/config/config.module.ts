import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import appConfig from './app.config';
import databaseConfig from './database.config';
import redisConfig from './redis.config';
import { authConfig } from '../auth/auth.config';
import { validateEnvironment } from './env.schema';

@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: ['.env.local', '.env'],
      load: [appConfig, databaseConfig, redisConfig, authConfig],
      validate: validateEnvironment,
    }),
  ],
})
export class ConfigModule {}
