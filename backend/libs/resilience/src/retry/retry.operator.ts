import { MonoTypeOperatorFunction, retry, throwError, timer } from 'rxjs';

import { RetryPolicy } from './retry.types';
import { getRetryDelay } from './retry.utils';

export function withRetry<T>(policy: RetryPolicy): MonoTypeOperatorFunction<T> {
  if (policy.maxAttempts < 1) {
    throw new Error('Retry maxAttempts must be at least 1');
  }

  return (source$) =>
    source$.pipe(
      retry({
        count: policy.maxAttempts - 1,
        delay: (error: unknown, retryNumber: number) => {
          const context = {
            error,
            attempt: retryNumber,
            nextAttempt: retryNumber + 1,
          };

          if (!policy.shouldRetry(context)) {
            return throwError(() => error);
          }

          const delayMs = getRetryDelay(retryNumber, policy);
          policy.onRetry?.(context, delayMs);
          return timer(delayMs);
        },
      }),
    );
}
