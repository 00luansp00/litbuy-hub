import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { RedisModule } from './redis/redis.module';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { AppLogger } from './common/logging/app-logger.service';

@Module({
  imports: [ConfigModule, DatabaseModule, RedisModule, HealthModule],
  providers: [AppLogger],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
