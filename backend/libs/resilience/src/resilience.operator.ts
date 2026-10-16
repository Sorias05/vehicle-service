import { MonoTypeOperatorFunction, Observable } from 'rxjs';

import { ServiceError } from '@app/shared';

import { withRetry } from './retry/retry.operator';
import { DEFAULT_RETRY_POLICY, RetryPolicy } from './retry/retry.types';
import { TimeoutPolicy, withTimeout } from './timeout/timeout.operator';

export interface ResiliencePolicy {
  timeout?: TimeoutPolicy;
  retry?: RetryPolicy;
}

export function withResilience<T>(
  policy: ResiliencePolicy,
): MonoTypeOperatorFunction<T> {
  return (source$: Observable<T>): Observable<T> => {
    let result$: Observable<T> = source$;

    if (policy.timeout) {
      result$ = withTimeout<T>(policy.timeout)(result$);
    }

    if (policy.retry) {
      result$ = withRetry<T>(policy.retry)(result$);
    }

    return result$;
  };
}

export interface CreateResilienceOptions {
  target: string;
  patternName: string;
  timeoutMs: number;
  retryEnabled: boolean;
  includeTimeout?: boolean;
  customRetryPolicy?: Partial<Omit<RetryPolicy, 'shouldRetry' | 'onRetry'>>;
}

export function createResilience<T = unknown>(
  options: CreateResilienceOptions,
): MonoTypeOperatorFunction<T> {
  const {
    target,
    patternName,
    timeoutMs,
    retryEnabled,
    includeTimeout = true,
    customRetryPolicy,
  } = options;

  return withResilience<T>({
    timeout: includeTimeout
      ? {
          timeoutMs,
          createError: () =>
            new ServiceError({
              type: 'TIMEOUT',
              service: target,
              operation: patternName,
              code: 'SERVICE_TIMEOUT',
              message:
                `Service "${target}" operation "${patternName}" ` +
                `timed out after ${timeoutMs}ms`,
              timeoutMs,
            }),
        }
      : undefined,

    retry: retryEnabled
      ? {
          ...DEFAULT_RETRY_POLICY,
          ...customRetryPolicy,

          shouldRetry: ({ error }) =>
            error instanceof ServiceError &&
            (error.type === 'TIMEOUT' || error.type === 'UNAVAILABLE'),

          onRetry: (context, delayMs) => {
            console.warn(
              `[Resilience Retry] #${context.attempt} ` +
                `for "${target}.${patternName}" ` +
                `after ${delayMs}ms.`,
            );
          },
        }
      : undefined,
  });
}
