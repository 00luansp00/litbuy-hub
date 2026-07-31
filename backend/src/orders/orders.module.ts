import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { CartCsrfGuard } from '../carts/cart-csrf.guard';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { OrderExpirationService } from './order-expiration.service';
@Module({
  imports: [DatabaseModule, AuthModule, JwtModule.register({})],
  controllers: [OrdersController],
  providers: [OrdersService, OrderExpirationService, CartCsrfGuard],
  exports: [OrdersService, OrderExpirationService],
})
export class OrdersModule {}
