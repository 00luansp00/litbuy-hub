import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import {
  PROVIDER_NOTIFICATION_INGRESS_CONFIG,
  type ProviderNotificationIngressConfig,
} from './provider-notification.config';

export type ProtectedNotification = {
  payloadHash: string;
  protectedKeyId: string;
  protectedVersion: number;
  protectedIv: Uint8Array;
  protectedCiphertext: Uint8Array;
  protectedAuthTag: Uint8Array;
};

@Injectable()
export class ProviderNotificationProtector {
  constructor(
    @Inject(PROVIDER_NOTIFICATION_INGRESS_CONFIG)
    private readonly config: ProviderNotificationIngressConfig,
  ) {}

  protect(token: string): ProtectedNotification {
    if (!this.config.key) throw new Error('Notification protection unavailable');
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.config.key, iv);
    cipher.setAAD(Buffer.from(`provider-notification:v1:${this.config.keyId}`));
    const ciphertext = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
    return {
      payloadHash: createHash('sha256').update(token).digest('hex'),
      protectedKeyId: this.config.keyId,
      protectedVersion: 1,
      protectedIv: iv,
      protectedCiphertext: ciphertext,
      protectedAuthTag: cipher.getAuthTag(),
    };
  }

  recover(value: Omit<ProtectedNotification, 'payloadHash'>): string {
    if (
      !this.config.key ||
      value.protectedVersion !== 1 ||
      value.protectedKeyId !== this.config.keyId
    )
      throw new Error('Notification protection unavailable');
    const decipher = createDecipheriv('aes-256-gcm', this.config.key, value.protectedIv);
    decipher.setAAD(Buffer.from(`provider-notification:v1:${value.protectedKeyId}`));
    decipher.setAuthTag(value.protectedAuthTag);
    return Buffer.concat([decipher.update(value.protectedCiphertext), decipher.final()]).toString(
      'utf8',
    );
  }
}
