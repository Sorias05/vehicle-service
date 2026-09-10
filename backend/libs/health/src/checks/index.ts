import { Type } from '@nestjs/common';

import { HealthDependency } from '../health.types';
import { AuthHealthCheck } from './auth.health';
import { PostgresHealthCheck } from './postgres.health';
import { RabbitMqHealthCheck } from './rabbitmq.health';
import { RedisHealthCheck } from './redis.health';
import { S3HealthCheck } from './s3.health';

export const HEALTH_CHECK_MAP: Record<HealthDependency, Type> = {
  postgres: PostgresHealthCheck,
  redis: RedisHealthCheck,
  rabbitmq: RabbitMqHealthCheck,
  s3: S3HealthCheck,
  auth: AuthHealthCheck,
};
