import { redactValue } from './redaction';

describe('redactValue', () => {
  it('redacts auth secrets from nested request log payloads', () => {
    const redacted = redactValue({
      headers: { authorization: 'Bearer secret-token', cookie: 'litbuy_refresh=secret' },
      body: { password: 'pass', twoFactorCode: '123456', publicField: 'ok' },
      email: 'person@example.test',
      route: '/api/v1/auth/login',
    });

    expect(JSON.stringify(redacted)).not.toContain('secret-token');
    expect(JSON.stringify(redacted)).not.toContain('person@example.test');
    expect(JSON.stringify(redacted)).not.toContain('123456');
    expect(redacted).toMatchObject({ route: '/api/v1/auth/login' });
  });
});
