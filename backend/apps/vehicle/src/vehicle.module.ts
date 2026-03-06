import { Module } from '@nestjs/common';
import { VehicleController } from './vehicle.controller';
import { VehicleService } from './vehicle.service';
import { SharedModule } from '@app/shared';
import { DatabaseModule } from '@app/database';
import { VehicleEntity } from '@app/database/entities/vehicle.entity';

@Module({
  imports: [
    SharedModule.registerConfig(),
    DatabaseModule.registerDatabase([VehicleEntity]),
  ],
  controllers: [VehicleController],
  providers: [VehicleService],
})
export class VehicleModule {}
