import { Module } from '@nestjs/common';

import { authGuardProvider } from '@app/authlib';
import { DatabaseModule } from '@app/database';
import { UserEntity } from '@app/database/entities/user.entity';
import { HealthModule } from '@app/health';
import { RabbitMqModule } from '@app/rabbitmq';
import { SharedModule } from '@app/shared';

import { UserController } from './user.controller';
import { UserService } from './user.service';

@Module({
  imports: [
    SharedModule.registerConfig(),
    RabbitMqModule.registerAuth(),
    RabbitMqModule.register('vehicle'),
    DatabaseModule.register([UserEntity]),
    HealthModule.register(['postgres', 'rabbitmq', 'auth']),
  ],
  controllers: [UserController],
  providers: [UserService, authGuardProvider],
})
export class UserModule {}
