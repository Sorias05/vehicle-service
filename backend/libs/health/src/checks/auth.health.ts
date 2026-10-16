import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { firstValueFrom, timeout } from 'rxjs';

import { getRabbitMqTransportToken } from '@app/rabbitmq';
import { RpcClient } from '@app/rpc';

import { HealthCheck, HealthCheckResult } from '../health.types';

@Injectable()
export class AuthHealthCheck implements HealthCheck {
  readonly name = 'auth' as const;

  constructor(private readonly moduleRef: ModuleRef) {}

  async check(): Promise<HealthCheckResult> {
    try {
      const client = this.moduleRef.get<RpcClient>(
        getRabbitMqTransportToken('auth'),
        { strict: false },
      );

      await firstValueFrom(
        client.send({ cmd: 'health' }, {}).pipe(timeout(2000)),
      );

      return {
        name: this.name,
        status: 'up',
      };
    } catch {
      return {
        name: this.name,
        status: 'down',
        message: 'Auth service is unavailable',
      };
    }
  }
}
