import { Module } from '@nestjs/common';

import { authGuardProvider } from '@app/authlib';
import { DatabaseModule } from '@app/database';
import { HealthModule } from '@app/health';
import { getRequestId, O11yModule, RPC_METRICS } from '@app/o11y';
import { getRabbitMqTransportToken, RabbitMqModule } from '@app/rabbitmq';
import { RedisModule } from '@app/redis';
import { createResilience } from '@app/resilience';
import { RpcModule } from '@app/rpc';
import { SharedModule } from '@app/shared';

import { AuthController } from './auth.controller';
import { AuthMessageController } from './auth.message.controller';
import { AuthService } from './auth.service';
import { UserEntity } from './entities/user.entity';
import { HashService } from './hash.service';
import { sessionStoreProvider } from './session/session.provider';
import { SessionService } from './session/session.service';

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
    DatabaseModule.register([UserEntity]),
    RedisModule,
    HealthModule.register(['postgres', 'redis', 'rabbitmq', 'auth']),
    O11yModule.register('auth'),
  ],
  controllers: [AuthController, AuthMessageController],
  providers: [
    AuthService,
    HashService,
    SessionService,
    sessionStoreProvider,
    authGuardProvider,
  ],
})
export class AuthModule {}
