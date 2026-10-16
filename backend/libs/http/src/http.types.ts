import type { AxiosRequestConfig, Method } from 'axios';
import type { MonoTypeOperatorFunction } from 'rxjs';

export interface HttpRequestContext {
  target: string;
  patternName: string;
  method: Method;
  url: string;
  timeoutMs: number;
  idempotent: boolean;
}

export type HttpResilienceBuilder = <T>(
  context: HttpRequestContext,
) => MonoTypeOperatorFunction<T>;

export interface HttpClientModuleOptions {
  target: string;
  baseURL?: string;
  requestTimeoutMs?: number;
  resilienceBuilder?: HttpResilienceBuilder;
}

export interface HttpRequestOptions<TData = unknown> extends Omit<
  AxiosRequestConfig<TData>,
  'baseURL' | 'timeout' | 'method' | 'url'
> {
  method: Method;
  url: string;
  operation?: string;
  timeoutMs?: number;
  idempotent?: boolean;
}
