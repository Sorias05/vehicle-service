import { Module } from '@nestjs/common';

import { authGuardProvider } from '@app/authlib';
import { DatabaseModule } from '@app/database';
import { HealthModule } from '@app/health';
import { getRequestId, O11yModule, RPC_METRICS } from '@app/o11y';
import { getRabbitMqTransportToken, RabbitMqModule } from '@app/rabbitmq';
import { createResilience } from '@app/resilience';
import { RpcModule } from '@app/rpc';
import { S3Module } from '@app/s3';
import { SharedModule } from '@app/shared';

import { FileEntity } from './entities/file.entity';
import { StorageController } from './storage.controller';
import { StorageService } from './storage.service';

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
    DatabaseModule.register([FileEntity]),
    S3Module,
    HealthModule.register(['postgres', 's3', 'rabbitmq', 'auth']),
    O11yModule.register('storage'),
  ],
  controllers: [StorageController],
  providers: [StorageService, authGuardProvider],
})
export class StorageModule {}
