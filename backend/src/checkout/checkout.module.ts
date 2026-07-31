import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { CartCsrfGuard } from '../carts/cart-csrf.guard';
import { CheckoutController } from './checkout.controller';
import { CheckoutService } from './checkout.service';
@Module({
  imports: [DatabaseModule],
  controllers: [CheckoutController],
  providers: [CheckoutService, CartCsrfGuard],
  exports: [CheckoutService],
})
export class CheckoutModule {}
