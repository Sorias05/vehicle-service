import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeleteResult, Repository, UpdateResult } from 'typeorm';
import { VehicleEntity } from '@app/database/entities/vehicle.entity';

@Injectable()
export class VehicleService {
  constructor(
    @InjectRepository(VehicleEntity)
    private readonly vehicleRepository: Repository<VehicleEntity>,
  ) {}

  async postVehicle(vehicle: any): Promise<VehicleEntity> {
    return this.vehicleRepository.save(vehicle);
  }

  async getVehicles(): Promise<VehicleEntity[]> {
    return this.vehicleRepository.find();
  }

  async getVehicle(id: number): Promise<VehicleEntity> {
    return this.vehicleRepository.findOne({ where: { id } });
  }

  async getVehicleByUser(userId: number): Promise<VehicleEntity> {
    return this.vehicleRepository.findOne({ where: { userId } });
  }

  async putVehicle(id: number, vehicle: any): Promise<UpdateResult> {
    return this.vehicleRepository.update(id, vehicle);
  }

  async deleteVehicle(id: number): Promise<DeleteResult> {
    return this.vehicleRepository.delete(id);
  }
}
