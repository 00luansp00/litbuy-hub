import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { FinancialLedgerService } from './financial-ledger.service';
import { SaleFinancialRecognitionService } from './sale-financial-recognition.service';
import {
  PaymentOrchestrationService,
  PAYMENT_PROVIDER_PORT,
} from './payment-orchestration.service';
import { EfiBillingNotificationProvider, EfiPaymentProvider } from './providers/efi';
import type { PaymentProviderPort } from './payment-provider.port';
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
import {
  PAYMENT_EVENT_PROVIDERS,
  ProviderWebhookEventProcessor,
} from './provider-webhook-event.processor';
@Module({
  imports: [DatabaseModule],
  controllers: [ProviderNotificationController],
  providers: [
    FinancialLedgerService,
    SaleFinancialRecognitionService,
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
    {
      provide: PAYMENT_EVENT_PROVIDERS,
      inject: [PAYMENT_PROVIDER_PORT],
      useFactory: (provider: PaymentProviderPort) => [provider],
    },
    ProviderWebhookEventProcessor,
  ],
  exports: [
    FinancialLedgerService,
    SaleFinancialRecognitionService,
    PaymentOrchestrationService,
    ProviderNotificationIngressService,
    ProviderNotificationInboxWorker,
    ProviderWebhookEventProcessor,
  ],
})
export class FinancialModule {}
