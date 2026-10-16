import { Module } from '@nestjs/common';

import { authGuardProvider } from '@app/authlib';
import { DatabaseModule } from '@app/database';
import { HealthModule } from '@app/health';
import { getRequestId, O11yModule, RPC_METRICS } from '@app/o11y';
import { getRabbitMqTransportToken, RabbitMqModule } from '@app/rabbitmq';
import { createResilience } from '@app/resilience';
import { RpcModule } from '@app/rpc';
import { SharedModule } from '@app/shared';

import { VehicleEntity } from './entities/vehicle.entity';
import { VehicleController } from './vehicle.controller';
import { VehicleService } from './vehicle.service';

@Module({
  imports: [
    SharedModule.registerConfig(),
    RpcModule.register({
      target: 'auth',
      transportModule: RabbitMqModule.register('auth', {
        requestIdProvider: getRequestId,
      }),
      transportToken: getRabbitMqTransportToken('auth'),
      rpcMetricsToken: RPC_METRICS,
      requestTimeoutMs: 5000,
      resilienceBuilder: <T>(ctx) =>
        createResilience<T>({
          target: ctx.target,
          patternName: ctx.patternName,
          timeoutMs: ctx.timeoutMs,
          retryEnabled: ctx.idempotent,
          includeTimeout: false,
        }),
    }),
    DatabaseModule.register([VehicleEntity]),
    HealthModule.register(['postgres', 'rabbitmq', 'auth']),
    O11yModule.register('vehicle'),
  ],
  controllers: [VehicleController],
  providers: [VehicleService, authGuardProvider],
})
export class VehicleModule {}
