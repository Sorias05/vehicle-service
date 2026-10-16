import { ServiceErrorPayload, ServiceErrorType } from './service-error';

const SERVICE_ERROR_TYPES = new Set<ServiceErrorType>([
  'TIMEOUT',
  'UNAVAILABLE',
  'NOT_FOUND',
  'INVALID',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'CONFLICT',
  'INTERNAL',
]);

export function isServiceErrorPayload(
  error: unknown,
): error is ServiceErrorPayload {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const value = error as Record<string, unknown>;

  return (
    typeof value.type === 'string' &&
    SERVICE_ERROR_TYPES.has(value.type as ServiceErrorType) &&
    typeof value.code === 'string' &&
    typeof value.message === 'string'
  );
}
