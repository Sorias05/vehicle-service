import { Module } from '@nestjs/common';

import { authGuardProvider } from '@app/authlib';
import { DatabaseModule } from '@app/database';
import { VehicleEntity } from '@app/database/entities/vehicle.entity';
import { HealthModule } from '@app/health';
import { RabbitMqModule } from '@app/rabbitmq';
import { SharedModule } from '@app/shared';

import { VehicleController } from './vehicle.controller';
import { VehicleService } from './vehicle.service';

@Module({
  imports: [
    SharedModule.registerConfig(),
    RabbitMqModule.registerAuth(),
    DatabaseModule.register([VehicleEntity]),
    HealthModule.register(['postgres', 'rabbitmq', 'auth']),
  ],
  controllers: [VehicleController],
  providers: [VehicleService, authGuardProvider],
})
export class VehicleModule {}
