import { HttpService } from '@nestjs/axios';
import { AxiosRequestConfig, isAxiosError, Method } from 'axios';
import { catchError, defer, map, Observable, throwError, timeout } from 'rxjs';

import {
  isServiceErrorPayload,
  ServiceError,
  ServiceErrorType,
} from '@app/shared';

import {
  HttpClientModuleOptions,
  HttpRequestContext,
  HttpRequestOptions,
} from './http.types';

const DEFAULT_REQUEST_TIMEOUT_MS = 5000;

const NETWORK_ERROR_CODES = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'ENETDOWN',
  'EPIPE',
  'ENOTFOUND',
  'EAI_AGAIN',
  'ERR_NETWORK',
]);

const TIMEOUT_ERROR_CODES = new Set(['ETIMEDOUT', 'ECONNABORTED']);

export class HttpClientService {
  constructor(
    private readonly httpService: HttpService,
    private readonly options: HttpClientModuleOptions,
  ) {}

  request<TResponse = unknown, TData = unknown>(
    requestOptions: HttpRequestOptions<TData>,
  ): Observable<TResponse> {
    const {
      method,
      url,
      data,
      operation,
      timeoutMs,
      idempotent = false,
      ...axiosOptions
    } = requestOptions;
    const normalizedMethod = method.toUpperCase() as Method;
    const requestTimeoutMs =
      timeoutMs ?? this.options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
    const patternName = operation ?? `${normalizedMethod} ${url}`;
    const context: HttpRequestContext = {
      target: this.options.target,
      patternName,
      method: normalizedMethod,
      url,
      timeoutMs: requestTimeoutMs,
      idempotent,
    };
    const config: AxiosRequestConfig<TData> = {
      ...axiosOptions,
      method: normalizedMethod,
      url,
      data,
    };
    const request$: Observable<TResponse> = defer(() =>
      this.httpService.request<TResponse>(config),
    ).pipe(
      map((response) => response.data),
      timeout(requestTimeoutMs),
      catchError((error: unknown) =>
        throwError(() =>
          normalizeHttpError(
            error,
            this.options.target,
            patternName,
            requestTimeoutMs,
          ),
        ),
      ),
    );

    const resilienceOperator =
      this.options.resilienceBuilder?.<TResponse>(context);

    return resilienceOperator ? request$.pipe(resilienceOperator) : request$;
  }
}

function normalizeHttpError(
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
      code: 'HTTP_TIMEOUT',
      message:
        `HTTP operation "${operation}" timed out ` + `after ${timeoutMs}ms`,
      timeoutMs,
      cause: error,
    });
  }

  if (!isAxiosError(error)) {
    return new ServiceError({
      type: 'INTERNAL',
      service: target,
      operation,
      code: 'HTTP_REQUEST_FAILED',
      message: `HTTP operation "${operation}" failed`,
      cause: error,
    });
  }

  if (error.code && TIMEOUT_ERROR_CODES.has(error.code)) {
    return new ServiceError({
      type: 'TIMEOUT',
      service: target,
      operation,
      code: 'HTTP_TIMEOUT',
      message: `HTTP operation "${operation}" timed out`,
      timeoutMs,
      cause: error,
    });
  }

  const responseData: unknown = error.response?.data;

  if (isServiceErrorPayload(responseData)) {
    return new ServiceError({
      type: responseData.type,
      service: target,
      operation,
      code: responseData.code,
      message: responseData.message,
      details: responseData.details,
      cause: error,
    });
  }

  const status = error.response?.status;

  if (status === undefined) {
    return new ServiceError({
      type:
        error.code && NETWORK_ERROR_CODES.has(error.code)
          ? 'UNAVAILABLE'
          : 'INTERNAL',
      service: target,
      operation,
      code:
        error.code && NETWORK_ERROR_CODES.has(error.code)
          ? 'HTTP_UNAVAILABLE'
          : 'HTTP_REQUEST_FAILED',
      message:
        error.code && NETWORK_ERROR_CODES.has(error.code)
          ? `HTTP target "${target}" is unavailable`
          : `HTTP operation "${operation}" failed`,
      cause: error,
    });
  }

  const type = mapHttpStatusToServiceError(status);
  const body = asRecord(responseData);

  return new ServiceError({
    type,
    service: target,
    operation,
    code: typeof body?.code === 'string' ? body.code : `HTTP_${status}`,
    message:
      typeof body?.message === 'string'
        ? body.message
        : `HTTP request failed with status ${status}`,
    details: body?.details,
    cause: error,
  });
}

function mapHttpStatusToServiceError(status: number): ServiceErrorType {
  if (status === 408 || status === 504) {
    return 'TIMEOUT';
  }
  if (status === 400 || status === 422) {
    return 'INVALID';
  }
  if (status === 401) {
    return 'UNAUTHORIZED';
  }
  if (status === 403) {
    return 'FORBIDDEN';
  }
  if (status === 404) {
    return 'NOT_FOUND';
  }
  if (status === 409) {
    return 'CONFLICT';
  }
  if (status === 429 || status >= 500) {
    return 'UNAVAILABLE';
  }
  return 'INTERNAL';
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (typeof value === 'object' && value !== null) {
    return value as Record<string, unknown>;
  }

  return undefined;
}
