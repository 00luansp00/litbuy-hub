import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { CartCsrfGuard } from '../carts/cart-csrf.guard';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { OrderExpirationService } from './order-expiration.service';
import { PaidOrderActivationService } from './paid-order-activation.service';
import { OrderFulfillmentController } from './order-fulfillment.controller';
import { OrderFulfillmentService } from './order-fulfillment.service';
@Module({
  imports: [DatabaseModule, AuthModule, JwtModule.register({})],
  controllers: [OrdersController, OrderFulfillmentController],
  providers: [
    OrdersService,
    OrderExpirationService,
    PaidOrderActivationService,
    OrderFulfillmentService,
    CartCsrfGuard,
  ],
  exports: [
    OrdersService,
    OrderExpirationService,
    PaidOrderActivationService,
    OrderFulfillmentService,
  ],
})
export class OrdersModule {}
