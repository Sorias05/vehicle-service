import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { VehicleService } from './vehicle.service';
import {
  Ctx,
  MessagePattern,
  Payload,
  RmqContext,
} from '@nestjs/microservices';

@Controller()
export class VehicleController {
  constructor(private readonly vehicleService: VehicleService) {}

  @MessagePattern({ cmd: 'user-created' })
  async postEmptyVehicle(
    @Ctx() context: RmqContext,
    @Payload() userId: number,
  ) {
    const channel = context.getChannelRef();
    const message = context.getMessage();
    channel.ack(message);
    return this.vehicleService.postVehicle({
      brand: 'Unknown',
      model: 'Unknown',
      year: 0,
      userId: userId,
    });
  }

  @MessagePattern({ cmd: 'get-vehicle-by-user' })
  async getVehicleByUser(
    @Ctx() context: RmqContext,
    @Payload() userId: number,
  ) {
    const channel = context.getChannelRef();
    const message = context.getMessage();
    channel.ack(message);
    return this.vehicleService.getVehicle(userId);
  }

  // @MessagePattern({ cmd: 'post-vehicle' })
  // async postVehicle(@Ctx() context: RmqContext, @Payload() vehicleDto: any) {
  //   const channel = context.getChannelRef();
  //   const message = context.getMessage();
  //   channel.ack(message);
  //   return this.vehicleService.postVehicle(vehicleDto);
  // }

  // @MessagePattern({ cmd: 'get-vehicles' })
  // async getVehicles(@Ctx() context: RmqContext) {
  //   const channel = context.getChannelRef();
  //   const message = context.getMessage();
  //   channel.ack(message);
  //   return this.vehicleService.getVehicles();
  // }

  // @MessagePattern({ cmd: 'get-vehicle' })
  // async getVehicle(@Ctx() context: RmqContext, @Payload() id: number) {
  //   const channel = context.getChannelRef();
  //   const message = context.getMessage();
  //   channel.ack(message);
  //   return this.vehicleService.getVehicle(id);
  // }

  // @MessagePattern({ cmd: 'put-vehicle' })
  // async putVehicle(@Ctx() context: RmqContext, @Payload() vehicleDto: any) {
  //   const channel = context.getChannelRef();
  //   const message = context.getMessage();
  //   channel.ack(message);
  //   return this.vehicleService.putVehicle(vehicleDto.id, vehicleDto);
  // }

  // @MessagePattern({ cmd: 'delete-vehicle' })
  // async deleteVehicle(@Ctx() context: RmqContext, @Payload() id: number) {
  //   const channel = context.getChannelRef();
  //   const message = context.getMessage();
  //   channel.ack(message);
  //   return this.vehicleService.deleteVehicle(id);
  // }

  @Post()
  async postVehicle(@Body() vehicleDto: any) {
    return this.vehicleService.postVehicle(vehicleDto);
  }

  @Get()
  async getVehicles() {
    return this.vehicleService.getVehicles();
  }

  @Get(':id')
  async getVehicle(@Param('id') id: number) {
    return this.vehicleService.getVehicle(id);
  }

  @Put(':id')
  async putVehicle(@Param('id') id: number, @Body() vehicleDto: any) {
    return this.vehicleService.putVehicle(id, vehicleDto);
  }

  @Delete(':id')
  async deleteVehicle(@Param('id') id: number) {
    return this.vehicleService.deleteVehicle(id);
  }
}
