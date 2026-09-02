import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { DisputeCoreService } from './dispute-core.service';
import { DisputeReleaseBlockerService } from './dispute-release-blocker.service';

@Module({
  imports: [DatabaseModule],
  providers: [DisputeCoreService, DisputeReleaseBlockerService],
  exports: [DisputeCoreService, DisputeReleaseBlockerService],
})
export class DisputesModule {}
