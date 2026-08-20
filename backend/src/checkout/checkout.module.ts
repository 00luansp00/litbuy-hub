import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { CartCsrfGuard } from '../carts/cart-csrf.guard';
import { CheckoutController } from './checkout.controller';
import { CheckoutService } from './checkout.service';
import { SellerReleasePolicyService } from '../financial/seller-release-policy.service';
import { ListingTierPolicyService } from '../financial/listing-tier-policy.service';
@Module({
  imports: [DatabaseModule, AuthModule, JwtModule.register({})],
  controllers: [CheckoutController],
  providers: [CheckoutService, CartCsrfGuard, SellerReleasePolicyService, ListingTierPolicyService],
  exports: [CheckoutService],
})
export class CheckoutModule {}
