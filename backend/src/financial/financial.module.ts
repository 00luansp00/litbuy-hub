import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { FinancialLedgerService } from './financial-ledger.service';
@Module({
  imports: [DatabaseModule],
  providers: [FinancialLedgerService],
  exports: [FinancialLedgerService],
})
export class FinancialModule {}
