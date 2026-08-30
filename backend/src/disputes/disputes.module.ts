import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { DisputeCoreService } from './dispute-core.service';

@Module({
  imports: [DatabaseModule],
  providers: [DisputeCoreService],
  exports: [DisputeCoreService],
})
export class DisputesModule {}
