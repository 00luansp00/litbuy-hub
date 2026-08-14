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
import { SellerOrdersController } from './seller-orders.controller';
import { SellerOrdersService } from './seller-orders.service';
import { PaidOrderAvailabilityOrchestrator } from './paid-order-availability.orchestrator';
@Module({
  imports: [DatabaseModule, AuthModule, JwtModule.register({})],
  controllers: [OrdersController, OrderFulfillmentController, SellerOrdersController],
  providers: [
    OrdersService,
    OrderExpirationService,
    PaidOrderActivationService,
    OrderFulfillmentService,
    PaidOrderAvailabilityOrchestrator,
    CartCsrfGuard,
    SellerOrdersService,
  ],
  exports: [
    OrdersService,
    OrderExpirationService,
    PaidOrderActivationService,
    OrderFulfillmentService,
    PaidOrderAvailabilityOrchestrator,
  ],
})
export class OrdersModule {}
