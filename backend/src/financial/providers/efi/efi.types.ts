export type EfiEnvironment = 'sandbox' | 'production';
export type EfiApiKind = 'billing' | 'pix';

export interface EfiApiProfile {
  kind: EfiApiKind;
  baseUrl: string;
  oauthPath: '/v1/authorize' | '/oauth/token';
  clientId: string;
  clientSecret: string;
  certificate?: string;
  privateKey?: string;
  timeoutMs: number;
}
export interface EfiConfig {
  enabled: boolean;
  environment: EfiEnvironment;
  nodeEnvironment: string;
  billing: EfiApiProfile;
  pix: EfiApiProfile;
  productionApproved: boolean;
}
export interface EfiChargeDataDto {
  charge_id: number;
  status: string;
  total: number;
}
export interface EfiChargeEnvelopeDto {
  code: number;
  data: EfiChargeDataDto;
}
export interface EfiBillingNotificationEventDto {
  id: number;
  type: string;
  status: { current: string; previous: string | null };
  identifiers: { charge_id: number };
  created_at: string;
}
export interface EfiBillingNotificationEnvelopeDto {
  code: number;
  data: EfiBillingNotificationEventDto[];
}
export interface EfiPixDto {
  endToEndId: string;
  txid: string;
  valor: string;
  horario: string;
  devolucoes?: unknown;
  tipo?: string;
  natureza?: string;
  movimento?: string;
}
export interface EfiPixWebhookDto {
  pix: EfiPixDto[];
}
export interface EfiHttpRequest {
  method: 'GET' | 'POST' | 'PUT';
  url: URL;
  headers: Record<string, string>;
  body?: string;
  timeoutMs: number;
  certificate?: string;
  privateKey?: string;
}
export interface EfiHttpResponse {
  status: number;
  headers: Record<string, string | string[] | undefined>;
  body: string;
}
export type EfiHttpTransport = (request: EfiHttpRequest) => Promise<EfiHttpResponse>;
