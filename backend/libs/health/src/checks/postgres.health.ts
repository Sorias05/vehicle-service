import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { DataSource } from 'typeorm';

import { HealthCheck, HealthCheckResult } from '../health.types';

@Injectable()
export class PostgresHealthCheck implements HealthCheck {
  readonly name = 'postgres' as const;

  constructor(private readonly moduleRef: ModuleRef) {}

  async check(): Promise<HealthCheckResult> {
    try {
      const dataSource = this.moduleRef.get<DataSource>(DataSource, {
        strict: false,
      });

      if (!dataSource?.isInitialized) {
        return {
          name: this.name,
          status: 'down',
          message: 'PostgreSQL connection is not initialized',
        };
      }

      await dataSource.query('SELECT 1');

      return {
        name: this.name,
        status: 'up',
      };
    } catch {
      return {
        name: this.name,
        status: 'down',
        message: 'PostgreSQL is unavailable',
      };
    }
  }
}
