export type HealthStatus = 'up' | 'down';

export interface HealthCheckResult {
  name: string;
  status: HealthStatus;
  message?: string;
}

export interface HealthCheck {
  name: string;
  check(): Promise<HealthCheckResult>;
}

export const HEALTH_CHECKS_TOKEN = 'HEALTH_CHECKS_TOKEN';

export const HEALTH_DEPENDENCIES = [
  'postgres',
  'redis',
  'rabbitmq',
  's3',
  'auth',
] as const;

export type HealthDependency = (typeof HEALTH_DEPENDENCIES)[number];

export type HealthCheckFn = () => Promise<HealthCheckResult>;
