import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { DisputeCoreService } from './dispute-core.service';
import { DisputeReleaseBlockerService } from './dispute-release-blocker.service';
import { DisputeFinancialDecisionService } from './dispute-financial-decision.service';
import { DisputeSellerLiabilityService } from './dispute-seller-liability.service';

@Module({
  imports: [DatabaseModule],
  providers: [
    DisputeCoreService,
    DisputeReleaseBlockerService,
    DisputeFinancialDecisionService,
    DisputeSellerLiabilityService,
  ],
  exports: [
    DisputeCoreService,
    DisputeReleaseBlockerService,
    DisputeFinancialDecisionService,
    DisputeSellerLiabilityService,
  ],
})
export class DisputesModule {}
