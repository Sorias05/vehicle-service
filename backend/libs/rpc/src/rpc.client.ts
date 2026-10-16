import {
  catchError,
  defer,
  finalize,
  Observable,
  tap,
  throwError,
  timeout,
} from 'rxjs';

import { isServiceErrorPayload, ServiceError } from '@app/shared';

import {
  RpcPattern,
  RpcRequestContext,
  RpcRequestOptions,
  RpcResilienceBuilder,
  RpcTransport,
} from './rpc.types';

export interface RpcMetricsSink {
  clientRequestStarted(): void;

  clientRequestFinished(
    target: string,
    pattern: string,
    status: 'success' | 'error' | 'timeout' | 'cancelled',
    durationSeconds: number,
  ): void;
}

export interface RpcClientOptions {
  target: string;
  requestTimeoutMs?: number;
  resilienceBuilder?: RpcResilienceBuilder;
}

const DEFAULT_REQUEST_TIMEOUT_MS = 5000;

export class RpcClient {
  constructor(
    private readonly transport: RpcTransport,
    private readonly options: RpcClientOptions,
    private readonly metrics?: RpcMetricsSink,
  ) {}

  send<TResponse = unknown>(
    pattern: RpcPattern,
    data: unknown,
    requestOptions: RpcRequestOptions = {},
  ): Observable<TResponse> {
    const patternName = getPatternName(pattern);

    const timeoutMs =
      requestOptions.timeoutMs ??
      this.options.requestTimeoutMs ??
      DEFAULT_REQUEST_TIMEOUT_MS;

    const context: RpcRequestContext = {
      target: this.options.target,
      patternName,
      timeoutMs,
      idempotent: requestOptions.idempotent ?? false,
    };

    return defer(() => {
      const startedAt = process.hrtime.bigint();

      let status: 'success' | 'error' | 'timeout' | 'cancelled' = 'cancelled';

      this.metrics?.clientRequestStarted();

      const request$ = defer(() =>
        this.transport.send<TResponse>(pattern, data),
      ).pipe(
        timeout(timeoutMs),

        catchError((error: unknown) =>
          throwError(() =>
            normalizeRpcError(
              error,
              this.options.target,
              patternName,
              timeoutMs,
            ),
          ),
        ),
      );

      const resilienceOperator =
        this.options.resilienceBuilder?.<TResponse>(context);

      const result$ = resilienceOperator
        ? request$.pipe(resilienceOperator)
        : request$;

      return result$.pipe(
        tap({
          next: () => {
            status = 'success';
          },

          error: (error: unknown) => {
            status =
              error instanceof ServiceError && error.type === 'TIMEOUT'
                ? 'timeout'
                : 'error';
          },
        }),

        finalize(() => {
          if (!this.metrics) {
            return;
          }

          const duration =
            Number(process.hrtime.bigint() - startedAt) / 1_000_000_000;

          this.metrics.clientRequestFinished(
            this.options.target,
            patternName,
            status,
            duration,
          );
        }),
      );
    });
  }
}

function normalizeRpcError(
  error: unknown,
  target: string,
  operation: string,
  timeoutMs: number,
): ServiceError {
  if (error instanceof ServiceError) {
    return error;
  }

  if (error instanceof Error && error.name === 'TimeoutError') {
    return new ServiceError({
      type: 'TIMEOUT',
      service: target,
      operation,
      code: 'SERVICE_TIMEOUT',
      message:
        `Service "${target}" operation "${operation}" ` +
        `timed out after ${timeoutMs}ms`,
      timeoutMs,
      cause: error,
    });
  }

  if (isServiceErrorPayload(error)) {
    return new ServiceError({
      type: error.type,
      service: target,
      operation,
      code: error.code,
      message: error.message,
      details: error.details,
    });
  }

  return new ServiceError({
    type: 'UNAVAILABLE',
    service: target,
    operation,
    code: 'SERVICE_UNAVAILABLE',
    message: `Service "${target}" is unavailable`,
    cause: error,
  });
}

function getPatternName(pattern: RpcPattern): string {
  if (typeof pattern === 'string') {
    return pattern;
  }

  if ('cmd' in pattern && typeof pattern.cmd === 'string') {
    return pattern.cmd;
  }

  return 'unknown';
}
