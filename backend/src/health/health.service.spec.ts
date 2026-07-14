import { ServiceUnavailableException } from '@nestjs/common';
import { HealthService } from './health.service';

describe('HealthService', () => {
  it('returns liveness without external dependencies', () => {
    const service = new HealthService(
      { isHealthy: jest.fn() } as never,
      { isHealthy: jest.fn() } as never,
    );

    expect(service.live()).toMatchObject({ status: 'ok' });
  });

  it('reports readiness dependencies as unavailable without throwing process errors', async () => {
    const service = new HealthService(
      { isHealthy: jest.fn().mockResolvedValue(false) } as never,
      { isHealthy: jest.fn().mockResolvedValue(false) } as never,
    );

    await expect(service.ready()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
