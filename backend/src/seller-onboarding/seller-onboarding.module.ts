import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { SellerOnboardingController } from './seller-onboarding.controller';
import { SellerOnboardingService } from './seller-onboarding.service';
@Module({
  imports: [DatabaseModule, AuthModule, JwtModule.register({})],
  controllers: [SellerOnboardingController],
  providers: [SellerOnboardingService],
})
export class SellerOnboardingModule {}
