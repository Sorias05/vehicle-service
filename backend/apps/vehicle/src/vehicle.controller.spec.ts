import { Test, TestingModule } from '@nestjs/testing';
import { VehicleController } from './vehicle.controller';
import { VehicleService } from './vehicle.service';

describe('VehicleController', () => {
  let vehicleController: VehicleController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [VehicleController],
      providers: [VehicleService],
    }).compile();

    vehicleController = app.get<VehicleController>(VehicleController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(vehicleController.getHello()).toBe('Hello World!');
    });
  });
});
