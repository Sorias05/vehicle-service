import { Module } from '@nestjs/common';

import { authGuardProvider } from '@app/authlib';
import { DatabaseModule } from '@app/database';
import { UserEntity } from '@app/database/entities/user.entity';
import { HealthModule } from '@app/health';
import { RabbitMqModule } from '@app/rabbitmq';
import { RedisModule } from '@app/redis';
import { SharedModule } from '@app/shared';

import { AuthController } from './auth.controller';
import { AuthMessageController } from './auth.message.controller';
import { AuthService } from './auth.service';
import { HashService } from './hash.service';
import { sessionStoreProvider } from './session/session.provider';
import { SessionService } from './session/session.service';

@Module({
  imports: [
    SharedModule.registerConfig(),
    RabbitMqModule.registerAuth(),
    DatabaseModule.register([UserEntity]),
    RedisModule,
    HealthModule.register(['postgres', 'redis', 'rabbitmq', 'auth']),
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
