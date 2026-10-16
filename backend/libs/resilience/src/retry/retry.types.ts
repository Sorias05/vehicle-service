export interface RetryContext {
  error: unknown;
  attempt: number;
  nextAttempt: number;
}

export interface RetryPolicy {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  jitterRatio: number;
  shouldRetry: (context: RetryContext) => boolean;
  onRetry?: (context: RetryContext, delayMs: number) => void;
}

export const DEFAULT_RETRY_POLICY: Omit<RetryPolicy, 'shouldRetry'> = {
  maxAttempts: 3,
  initialDelayMs: 200,
  maxDelayMs: 2000,
  backoffMultiplier: 2,
  jitterRatio: 0.2,
};
