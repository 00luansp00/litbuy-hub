export type EfiErrorCode =
  | 'AUTHENTICATION_FAILED'
  | 'INVALID_REQUEST'
  | 'NOT_FOUND'
  | 'RATE_LIMITED'
  | 'PROVIDER_UNAVAILABLE'
  | 'TIMEOUT'
  | 'AMBIGUOUS_RESULT'
  | 'INVALID_PROVIDER_RESPONSE'
  | 'UNSUPPORTED_OPERATION'
  | 'UNVERIFIED_TRANSPORT';

export class EfiProviderError extends Error {
  constructor(
    readonly code: EfiErrorCode,
    readonly retryable: boolean,
    readonly requiresReconciliation: boolean,
    readonly correlationId?: string,
  ) {
    super(`Efí request failed: ${code}`);
    this.name = 'EfiProviderError';
  }
}

export function mapEfiHttpError(status: number, correlationId?: string): EfiProviderError {
  if (status === 401 || status === 403)
    return new EfiProviderError('AUTHENTICATION_FAILED', false, false, correlationId);
  if (status === 404) return new EfiProviderError('NOT_FOUND', false, false, correlationId);
  if (status === 429) return new EfiProviderError('RATE_LIMITED', true, false, correlationId);
  if (status >= 500) return new EfiProviderError('PROVIDER_UNAVAILABLE', true, true, correlationId);
  return new EfiProviderError('INVALID_REQUEST', false, false, correlationId);
}
