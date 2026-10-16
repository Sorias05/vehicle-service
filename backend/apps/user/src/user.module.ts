import { Module } from '@nestjs/common';

import { authGuardProvider } from '@app/authlib';
import { DatabaseModule } from '@app/database';
import { HealthModule } from '@app/health';
import { HttpClientModule } from '@app/http';
import { getRequestId, O11yModule, RPC_METRICS } from '@app/o11y';
import { getRabbitMqTransportToken, RabbitMqModule } from '@app/rabbitmq';
import { createResilience } from '@app/resilience';
import { RpcModule } from '@app/rpc';
import { SharedModule } from '@app/shared';

import { UserEntity } from './entities/user.entity';
import { UserController } from './user.controller';
import { UserService } from './user.service';

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
    RpcModule.register({
      target: 'vehicle',
      transportModule: RabbitMqModule.register('vehicle', {
        requestIdProvider: getRequestId,
      }),
      transportToken: getRabbitMqTransportToken('vehicle'),
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
    HttpClientModule.register({
      target: 'external-vehicle-api',
      baseURL: process.env.EXTERNAL_VEHICLE_API_URL || "http://vehicle:5001",
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
    DatabaseModule.register([UserEntity]),
    HealthModule.register(['postgres', 'rabbitmq', 'auth']),
    O11yModule.register('user'),
  ],
  controllers: [UserController],
  providers: [UserService, authGuardProvider],
})
export class UserModule {}
