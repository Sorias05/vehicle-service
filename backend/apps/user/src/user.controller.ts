import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  ParseIntPipe,
  Put,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { firstValueFrom } from 'rxjs';

import { HttpClientService } from '@app/http';
import { getRpcClientToken, RpcClient } from '@app/rpc';

import { HashService } from './hash.service';
import { UserService } from './user.service';

@Controller()
export class UserController {
  constructor(
    private readonly userService: UserService,
    @Inject(getRpcClientToken('vehicle'))
    private readonly vehicleRpc: RpcClient,
    private readonly vehicleService: HttpClientService,
  ) {}

  @Get('profile')
  async getProfile(@Req() req: any) {
    const id = req.session.userId;

    if (!id) {
      throw new UnauthorizedException();
    }

    return this.userService.getUser(id);
  }

  @Get()
  async getUsers() {
    return this.userService.getUsers();
  }

  @Get(':id')
  async getUser(@Param('id', ParseIntPipe) id: number) {
    const user = await this.userService.getUser(id);
    const vehicle = await this.getVehicleByUserId(id);
    // const vehicle = await firstValueFrom(
    //   this.vehicleService.request({
    //     method: 'GET',
    //     url: '/',
    //     idempotent: true,
    //   }),
    // );

    return {
      ...user,
      vehicle,
    };
  }

  @Put(':id')
  async putUser(@Param('id') id: number, @Body() userDto: any) {
    const password = HashService.hash(userDto.password);
    return this.userService.putUser(id, { ...userDto, password });
  }

  @Delete(':id')
  async deleteUser(@Param('id') id: number) {
    return this.userService.deleteUser(id);
  }

  async getVehicleByUserId(userId: number) {
    return firstValueFrom(
      this.vehicleRpc.send({ cmd: 'get-vehicle-by-user' }, userId, {
        idempotent: true,
      }),
    );
  }

  async postVehicle(vehicle: any) {
    return firstValueFrom(
      this.vehicleRpc.send({ cmd: 'post-vehicle' }, vehicle, {
        idempotent: true,
      }),
    );
  }

  async postEmptyVehicle(userId: number) {
    return firstValueFrom(
      this.vehicleRpc.send({ cmd: 'user-created' }, userId, {
        idempotent: true,
      }),
    );
  }
}
