export type EfiEnvironment = 'sandbox' | 'production';

export interface EfiConfig {
  enabled: boolean;
  environment: EfiEnvironment;
  apiBaseUrl: string;
  clientId: string;
  clientSecret: string;
  certificate: string;
  privateKey: string;
  webhookSecret: string;
  timeoutMs: number;
  productionApproved: boolean;
}

export interface EfiChargeDto {
  id: string | number;
  status: string;
  total: number;
}

export interface EfiWebhookDto {
  id: string;
  type: string;
  charge_id: string | number;
  status: string;
}

export interface EfiHttpRequest {
  method: 'GET' | 'POST' | 'PUT';
  url: URL;
  headers: Record<string, string>;
  body?: string;
  timeoutMs: number;
  certificate: string;
  privateKey: string;
}

export interface EfiHttpResponse {
  status: number;
  headers: Record<string, string | string[] | undefined>;
  body: string;
}

export type EfiHttpTransport = (request: EfiHttpRequest) => Promise<EfiHttpResponse>;
