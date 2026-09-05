import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { DisputeCoreService } from './dispute-core.service';
import { DisputeReleaseBlockerService } from './dispute-release-blocker.service';
import { DisputeFinancialDecisionService } from './dispute-financial-decision.service';

@Module({
  imports: [DatabaseModule],
  providers: [DisputeCoreService, DisputeReleaseBlockerService, DisputeFinancialDecisionService],
  exports: [DisputeCoreService, DisputeReleaseBlockerService, DisputeFinancialDecisionService],
})
export class DisputesModule {}
