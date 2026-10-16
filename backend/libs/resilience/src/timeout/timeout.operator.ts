import {
  catchError,
  MonoTypeOperatorFunction,
  throwError,
  timeout,
} from 'rxjs';

export interface TimeoutPolicy {
  timeoutMs: number;
  createError: () => unknown;
}

export function withTimeout<T>(
  policy: TimeoutPolicy,
): MonoTypeOperatorFunction<T> {
  if (policy.timeoutMs <= 0) {
    throw new Error('Timeout must be greater than 0');
  }

  return (source$) =>
    source$.pipe(
      timeout(policy.timeoutMs),
      catchError((error: unknown) => {
        if (error instanceof Error && error.name === 'TimeoutError') {
          return throwError(() => policy.createError());
        }
        return throwError(() => error);
      }),
    );
}
