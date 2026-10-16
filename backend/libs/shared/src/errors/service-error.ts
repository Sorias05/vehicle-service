export type ServiceErrorType =
  | 'TIMEOUT'
  | 'UNAVAILABLE'
  | 'NOT_FOUND'
  | 'INVALID'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'CONFLICT'
  | 'INTERNAL';

export interface ServiceErrorPayload {
  type: ServiceErrorType;
  code: string;
  message: string;
  details?: unknown;
}

export interface ServiceErrorOptions extends ServiceErrorPayload {
  service: string;
  operation: string;
  timeoutMs?: number;
  cause?: unknown;
}

export class ServiceError extends Error {
  readonly type: ServiceErrorType;
  readonly service: string;
  readonly operation: string;
  readonly code: string;
  readonly details?: unknown;
  readonly timeoutMs?: number;
  readonly cause?: unknown;

  constructor(options: ServiceErrorOptions) {
    super(options.message);

    this.name = 'ServiceError';

    this.type = options.type;
    this.service = options.service;
    this.operation = options.operation;
    this.code = options.code;
    this.details = options.details;
    this.timeoutMs = options.timeoutMs;
    this.cause = options.cause;

    Object.setPrototypeOf(this, new.target.prototype);
  }

  toPayload(): ServiceErrorPayload {
    return {
      type: this.type,
      code: this.code,
      message: this.message,
      ...(this.details !== undefined ? { details: this.details } : {}),
    };
  }
}
