import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';

import { REDIS_CLIENT } from '@app/redis';

import { HealthCheck, HealthCheckResult } from '../health.types';

@Injectable()
export class RedisHealthCheck implements HealthCheck {
  readonly name = 'redis' as const;

  constructor(private readonly moduleRef: ModuleRef) {}

  async check(): Promise<HealthCheckResult> {
    try {
      const client = this.moduleRef.get<any>(REDIS_CLIENT, { strict: false });

      if (!client?.isReady) {
        return {
          name: this.name,
          status: 'down',
          message: 'Redis client is not ready',
        };
      }

      await client.ping();

      return {
        name: this.name,
        status: 'up',
      };
    } catch {
      return {
        name: this.name,
        status: 'down',
        message: 'Redis is unavailable',
      };
    }
  }
}
