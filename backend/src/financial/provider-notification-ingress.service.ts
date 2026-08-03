import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { parseBillingNotificationToken } from './providers/efi/efi-notification-provider';
import {
  PROVIDER_NOTIFICATION_INGRESS_CONFIG,
  type ProviderNotificationIngressConfig,
} from './provider-notification.config';
import { ProviderNotificationProtector } from './provider-notification-protector';

@Injectable()
export class ProviderNotificationIngressService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly protector: ProviderNotificationProtector,
    @Inject(PROVIDER_NOTIFICATION_INGRESS_CONFIG)
    private readonly config: ProviderNotificationIngressConfig,
  ) {}

  async acceptEfiBilling(notification: string): Promise<void> {
    if (!this.config.efiBillingEnabled)
      throw new ServiceUnavailableException({ code: 'NOTIFICATION_INGRESS_DISABLED' });
    // Reuse the adapter's strict token grammar without retaining the form body.
    const token = parseBillingNotificationToken(
      Buffer.from(`notification=${encodeURIComponent(notification)}`),
    );
    const protectedToken = this.protector.protect(token);
    await this.prisma.providerNotificationInbox.create({
      data: {
        providerCode: 'EFI_BILLING',
        notificationKind: 'BILLING_TOKEN',
        contentType: 'application/x-www-form-urlencoded',
        ...protectedToken,
        protectedIv: Uint8Array.from(protectedToken.protectedIv),
        protectedCiphertext: Uint8Array.from(protectedToken.protectedCiphertext),
        protectedAuthTag: Uint8Array.from(protectedToken.protectedAuthTag),
      },
      select: { id: true },
    });
  }
}
