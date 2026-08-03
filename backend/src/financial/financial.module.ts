import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { FinancialLedgerService } from './financial-ledger.service';
import {
  PaymentOrchestrationService,
  PAYMENT_PROVIDER_PORT,
} from './payment-orchestration.service';
import { EfiPaymentProvider } from './providers/efi';
import { readEfiConfig } from './providers/efi/efi.config';
@Module({
  imports: [DatabaseModule],
  providers: [
    FinancialLedgerService,
    PaymentOrchestrationService,
    { provide: PAYMENT_PROVIDER_PORT, useFactory: () => new EfiPaymentProvider(readEfiConfig()) },
  ],
  exports: [FinancialLedgerService, PaymentOrchestrationService],
})
export class FinancialModule {}
