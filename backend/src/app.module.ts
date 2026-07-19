import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { RedisModule } from './redis/redis.module';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { RequestLoggingMiddleware } from './common/middleware/request-logging.middleware';
import { AppLogger } from './common/logging/app-logger.service';
import { AuthModule } from './auth/auth.module';
import { SellerOnboardingModule } from './seller-onboarding/seller-onboarding.module';
import { CatalogModule } from './catalog/catalog.module';
import { ListingDraftsModule } from './listing-drafts/listing-drafts.module';
import { ProductsModule } from './products/products.module';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    RedisModule,
    HealthModule,
    AuthModule,
    SellerOnboardingModule,
    CatalogModule,
    ListingDraftsModule,
    ProductsModule,
  ],
  providers: [AppLogger],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware, RequestLoggingMiddleware).forRoutes('*');
  }
}
