import { Module } from '@nestjs/common';
import { OrdersModule } from '../orders/orders.module';
import { FakePaymentProvider } from './fake-payment-provider';
import { ALPHA_PAYMENT_CONFIG, readAlphaPaymentConfig } from './alpha-payment.config';
import { BuyerPaymentController } from './buyer-payment.controller';
import { BuyerPaymentService } from './buyer-payment.service';
import { JwtModule } from '@nestjs/jwt';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { FinancialLedgerService } from './financial-ledger.service';
import { SaleFinancialRecognitionService } from './sale-financial-recognition.service';
import { SellerPendingHoldService } from './seller-pending-hold.service';
import { SellerHoldEligibilityService } from './seller-hold-eligibility.service';
import { SellerHeldFundsReleaseService } from './seller-held-funds-release.service';
import { SellerReleasePolicyService } from './seller-release-policy.service';
import { SellerFinanceController } from './seller-finance.controller';
import { SellerFinanceReadService } from './seller-finance-read.service';
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
  imports: [DatabaseModule, AuthModule, OrdersModule, JwtModule.register({})],
  controllers: [ProviderNotificationController, SellerFinanceController, BuyerPaymentController],
  providers: [
    FinancialLedgerService,
    SellerFinanceReadService,
    SaleFinancialRecognitionService,
    SellerPendingHoldService,
    SellerHoldEligibilityService,
    SellerHeldFundsReleaseService,
    SellerReleasePolicyService,
    PaymentOrchestrationService,
    BuyerPaymentService,
    { provide: ALPHA_PAYMENT_CONFIG, useFactory: readAlphaPaymentConfig },
    {
      provide: PAYMENT_PROVIDER_PORT,
      useFactory: () =>
        readAlphaPaymentConfig().enabled
          ? new FakePaymentProvider('FAKE_ALPHA')
          : new EfiPaymentProvider(readEfiConfig()),
    },
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
    SellerPendingHoldService,
    SellerHoldEligibilityService,
    SellerHeldFundsReleaseService,
    SellerReleasePolicyService,
    PaymentOrchestrationService,
    ProviderNotificationIngressService,
    ProviderNotificationInboxWorker,
    ProviderWebhookEventProcessor,
  ],
})
export class FinancialModule {}
