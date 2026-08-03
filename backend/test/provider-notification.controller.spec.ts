import express from 'express';
import { ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { ProviderNotificationController } from '../src/financial/provider-notification.controller';
import { ProviderNotificationIngressService } from '../src/financial/provider-notification-ingress.service';

describe('Efí Billing callback HTTP boundary', () => {
  let app: INestApplication;
  const acceptEfiBilling = jest.fn();
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [ProviderNotificationController],
      providers: [{ provide: ProviderNotificationIngressService, useValue: { acceptEfiBilling } }],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use(express.json());
    app.use(express.urlencoded({ extended: false }));
    app.useGlobalPipes(
      new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }),
    );
    await app.init();
  });
  beforeEach(() => acceptEfiBilling.mockReset().mockResolvedValue(undefined));
  afterAll(() => app.close());

  it('returns an empty 204 only after durable acceptance resolves', async () => {
    let commit!: () => void;
    acceptEfiBilling.mockReturnValue(new Promise<void>((resolve) => (commit = resolve)));
    const pending = request(app.getHttpServer())
      .post('/api/v1/webhooks/efi/billing')
      .type('form')
      .send({ notification: 'valid_token_123' });
    let settled = false;
    const responsePromise = pending.then((response) => {
      settled = true;
      return response;
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(settled).toBe(false);
    commit();
    const response = await responsePromise;
    expect(response.status).toBe(204);
    expect(response.text).toBe('');
    expect(response.text).not.toContain('valid_token_123');
  });

  it('rejects wrong content type, malformed payloads, and extra fields', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/webhooks/efi/billing')
      .send({ notification: 'valid_token_123' })
      .expect(415);
    await request(app.getHttpServer())
      .post('/api/v1/webhooks/efi/billing')
      .type('form')
      .send({ notification: 'bad token' })
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/v1/webhooks/efi/billing')
      .type('form')
      .send({ notification: 'valid_token_123', extra: 'rejected' })
      .expect(400);
    expect(acceptEfiBilling).not.toHaveBeenCalled();
  });

  it('does not acknowledge persistence failure', async () => {
    acceptEfiBilling.mockRejectedValue(new Error('database unavailable'));
    await request(app.getHttpServer())
      .post('/api/v1/webhooks/efi/billing')
      .type('form')
      .send({ notification: 'valid_token_123' })
      .expect(500);
  });
});
