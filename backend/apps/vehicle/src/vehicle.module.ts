import { Module } from '@nestjs/common';

import { authGuardProvider } from '@app/authlib';
import { DatabaseModule } from '@app/database';
import { VehicleEntity } from '@app/database/entities/vehicle.entity';
import { HealthModule } from '@app/health';
import { getRequestId, O11yModule, RPC_METRICS } from '@app/o11y';
import { RabbitMqModule } from '@app/rabbitmq';
import { SharedModule } from '@app/shared';

import { VehicleController } from './vehicle.controller';
import { VehicleService } from './vehicle.service';

@Module({
  imports: [
    SharedModule.registerConfig(),
    RabbitMqModule.registerAuth({
      requestIdProvider: getRequestId,
      rpcMetricsToken: RPC_METRICS,
    }),
    DatabaseModule.register([VehicleEntity]),
    HealthModule.register(['postgres', 'rabbitmq', 'auth']),
    O11yModule.register('vehicle'),
  ],
  controllers: [VehicleController],
  providers: [VehicleService, authGuardProvider],
})
export class VehicleModule {}
