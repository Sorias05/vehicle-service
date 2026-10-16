import { MonoTypeOperatorFunction, Observable } from 'rxjs';

export type RpcPattern = string | Record<string, unknown>;

export interface RpcTransport {
  send<TResponse = unknown>(
    pattern: RpcPattern,
    data: unknown,
  ): Observable<TResponse>;
  connect(): Promise<void>;
  close(): void;
}

export interface RpcRequestOptions {
  idempotent?: boolean;
  timeoutMs?: number;
}

export interface RpcRequestContext {
  target: string;
  patternName: string;
  timeoutMs: number;
  idempotent: boolean;
}

export type RpcResilienceBuilder = <T>(
  context: RpcRequestContext,
) => MonoTypeOperatorFunction<T>;
