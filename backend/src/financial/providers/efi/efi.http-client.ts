import { request as httpsRequest } from 'node:https';
import type { EfiApiProfile, EfiHttpRequest, EfiHttpResponse, EfiHttpTransport } from './efi.types';
import { EfiProviderError, mapEfiHttpError } from './efi.errors';

export const nodeEfiTransport: EfiHttpTransport = (input) =>
  new Promise((resolve, reject) => {
    const request = httpsRequest(
      input.url,
      {
        method: input.method,
        headers: input.headers,
        ...(input.certificate ? { cert: input.certificate } : {}),
        ...(input.privateKey ? { key: input.privateKey } : {}),
        rejectUnauthorized: true,
        timeout: input.timeoutMs,
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.on('end', () =>
          resolve({
            status: response.statusCode ?? 0,
            headers: response.headers,
            body: Buffer.concat(chunks).toString('utf8'),
          }),
        );
      },
    );
    request.on('timeout', () => request.destroy(new Error('EFI_TIMEOUT')));
    request.on('error', reject);
    if (input.body) request.write(input.body);
    request.end();
  });

export class EfiHttpClient {
  private accessToken?: { value: string; expiresAt: number };
  constructor(
    private readonly profile: EfiApiProfile,
    private readonly transport: EfiHttpTransport = nodeEfiTransport,
  ) {}

  async send(method: EfiHttpRequest['method'], path: string, body: unknown) {
    const token = await this.authenticate();
    return this.execute({
      method,
      url: new URL(path, this.profile.baseUrl),
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
        accept: 'application/json',
        'x-correlation-id': crypto.randomUUID(),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      timeoutMs: this.profile.timeoutMs,
      certificate: this.profile.certificate,
      privateKey: this.profile.privateKey,
    });
  }

  private async authenticate(): Promise<string> {
    if (this.accessToken && this.accessToken.expiresAt > Date.now() + 30_000)
      return this.accessToken.value;
    const response = await this.execute({
      method: 'POST',
      url: new URL(this.profile.oauthPath, this.profile.baseUrl),
      headers: {
        authorization: `Basic ${Buffer.from(`${this.profile.clientId}:${this.profile.clientSecret}`).toString('base64')}`,
        'content-type': 'application/json',
        'x-correlation-id': crypto.randomUUID(),
      },
      body: JSON.stringify({ grant_type: 'client_credentials' }),
      timeoutMs: this.profile.timeoutMs,
      certificate: this.profile.certificate,
      privateKey: this.profile.privateKey,
    });
    const parsed = safeObject(response.body);
    if (typeof parsed.access_token !== 'string' || typeof parsed.expires_in !== 'number')
      throw new EfiProviderError('INVALID_PROVIDER_RESPONSE', false, false);
    this.accessToken = {
      value: parsed.access_token,
      expiresAt: Date.now() + parsed.expires_in * 1000,
    };
    return parsed.access_token;
  }

  private async execute(request: EfiHttpRequest): Promise<EfiHttpResponse> {
    try {
      const response = await this.transport(request);
      const correlation = header(response, 'x-correlation-id');
      if (response.status < 200 || response.status >= 300)
        throw mapEfiHttpError(response.status, request.method, correlation);
      return response;
    } catch (error) {
      if (error instanceof EfiProviderError) throw error;
      const read = request.method === 'GET';
      const timedOut = error instanceof Error && error.message === 'EFI_TIMEOUT';
      throw new EfiProviderError(
        read && timedOut ? 'TIMEOUT' : read ? 'PROVIDER_UNAVAILABLE' : 'AMBIGUOUS_RESULT',
        read,
        !read,
      );
    }
  }
}

export function safeObject(body: string): Record<string, unknown> {
  try {
    const value: unknown = JSON.parse(body);
    if (value && typeof value === 'object' && !Array.isArray(value))
      return value as Record<string, unknown>;
  } catch {
    // Normalized below; provider response bodies are deliberately not exposed.
  }
  throw new EfiProviderError('INVALID_PROVIDER_RESPONSE', false, true);
}
function header(response: EfiHttpResponse, name: string): string | undefined {
  const value = response.headers[name];
  return Array.isArray(value) ? value[0] : value;
}
