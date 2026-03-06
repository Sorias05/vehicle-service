import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Post,
  Put,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { UserService } from './user.service';

@Controller()
export class UserController {
  constructor(
    private readonly userService: UserService,
    @Inject('VEHICLE_SERVICE') private vehicleService: ClientProxy,
  ) {}

  @Post('register')
  async register(@Body() userDto: any) {
    const user = await this.userService.register(userDto);

    if (!user) return user;

    return {
      ...user,
      vehicle: await this.postEmptyVehicle(user.id),
    };
  }

  @Post('login')
  async login(@Body() userDto: any, @Req() req: any) {
    const user = await this.userService.validateUser(userDto);

    if (!user) {
      throw new UnauthorizedException();
    }

    req.session.userId = user.id;

    return { message: `Logged in as ${user.email}` };
  }

  @Get('profile')
  getProfile(@Req() req: any) {
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
  async getUser(@Param('id') id: number) {
    const user = await this.userService.getUser(id);

    return {
      ...user,
      vehicle: await this.getVehicleByUserId(id),
    };
  }

  @Put(':id')
  async putUser(@Param('id') id: number, @Body() userDto: any) {
    return this.userService.putUser(id, userDto);
  }

  @Delete(':id')
  async deleteUser(@Param('id') id: number) {
    return this.userService.deleteUser(id);
  }

  async getVehicleByUserId(userId: number) {
    return firstValueFrom(
      this.vehicleService.send({ cmd: 'get-vehicle-by-user' }, userId),
    );
  }

  async postVehicle(vehicle: any) {
    return firstValueFrom(
      this.vehicleService.send({ cmd: 'post-vehicle' }, vehicle),
    );
  }

  async postEmptyVehicle(userId: number) {
    return firstValueFrom(
      this.vehicleService.send({ cmd: 'user-created' }, userId),
    );
  }
}
