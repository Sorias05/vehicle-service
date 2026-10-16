import { DEFAULT_RETRY_POLICY, RetryPolicy } from './retry.types';

export function getRetryDelay(
  retryNumber: number,
  policy: RetryPolicy,
): number {
  const exponentialDelay =
    policy.initialDelayMs * Math.pow(policy.backoffMultiplier, retryNumber - 1);
  const cappedDelay = Math.min(exponentialDelay, policy.maxDelayMs);

  if (policy.jitterRatio <= 0) {
    return cappedDelay;
  }

  const jitter = cappedDelay * policy.jitterRatio * (Math.random() * 2 - 1);
  return Math.max(0, Math.round(cappedDelay + jitter));
}

export function createRetryPolicy(
  overrides: Partial<Omit<RetryPolicy, 'shouldRetry'>>,
  shouldRetry: RetryPolicy['shouldRetry'],
): RetryPolicy {
  return {
    ...DEFAULT_RETRY_POLICY,
    ...overrides,
    shouldRetry,
  };
}
