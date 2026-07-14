export interface ErrorResponse {
  statusCode: number;
  code: string;
  message: string;
  details: unknown[];
  requestId: string;
  timestamp: string;
  path: string;
}
