import { Module } from '@nestjs/common';

import { authGuardProvider } from '@app/authlib';
import { DatabaseModule } from '@app/database';
import { UserEntity } from '@app/database/entities/user.entity';
import { HealthModule } from '@app/health';
import { getRequestId, O11yModule, RPC_METRICS } from '@app/o11y';
import { RabbitMqModule } from '@app/rabbitmq';
import { SharedModule } from '@app/shared';

import { UserController } from './user.controller';
import { UserService } from './user.service';

@Module({
  imports: [
    SharedModule.registerConfig(),
    RabbitMqModule.registerAuth({
      requestIdProvider: getRequestId,
      rpcMetricsToken: RPC_METRICS,
    }),
    RabbitMqModule.register('vehicle', {
      requestIdProvider: getRequestId,
      rpcMetricsToken: RPC_METRICS,
    }),
    DatabaseModule.register([UserEntity]),
    HealthModule.register(['postgres', 'rabbitmq', 'auth']),
    O11yModule.register('user'),
  ],
  controllers: [UserController],
  providers: [UserService, authGuardProvider],
})
export class UserModule {}
