import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { FinancialLedgerService } from './financial-ledger.service';
import {
  PaymentOrchestrationService,
  PAYMENT_PROVIDER_PORT,
} from './payment-orchestration.service';
import { EfiBillingNotificationProvider, EfiPaymentProvider } from './providers/efi';
import { readEfiConfig } from './providers/efi/efi.config';
import { ProviderNotificationController } from './provider-notification.controller';
import {
  PROVIDER_NOTIFICATION_INGRESS_CONFIG,
  readProviderNotificationIngressConfig,
} from './provider-notification.config';
import { ProviderNotificationProtector } from './provider-notification-protector';
import { ProviderNotificationIngressService } from './provider-notification-ingress.service';
import {
  PAYMENT_NOTIFICATION_PROVIDERS,
  ProviderNotificationInboxWorker,
} from './provider-notification-inbox.worker';
@Module({
  imports: [DatabaseModule],
  controllers: [ProviderNotificationController],
  providers: [
    FinancialLedgerService,
    PaymentOrchestrationService,
    { provide: PAYMENT_PROVIDER_PORT, useFactory: () => new EfiPaymentProvider(readEfiConfig()) },
    {
      provide: PROVIDER_NOTIFICATION_INGRESS_CONFIG,
      useFactory: () => {
        const ingress = readProviderNotificationIngressConfig();
        const efi = readEfiConfig();
        if (ingress.efiBillingEnabled && !efi.enabled)
          throw new Error('Efí Billing notification ingress requires EFI_ENABLED');
        return ingress;
      },
    },
    ProviderNotificationProtector,
    ProviderNotificationIngressService,
    {
      provide: PAYMENT_NOTIFICATION_PROVIDERS,
      useFactory: () => [new EfiBillingNotificationProvider(readEfiConfig())],
    },
    ProviderNotificationInboxWorker,
  ],
  exports: [
    FinancialLedgerService,
    PaymentOrchestrationService,
    ProviderNotificationIngressService,
    ProviderNotificationInboxWorker,
  ],
})
export class FinancialModule {}
