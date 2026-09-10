import { Controller, Get } from '@nestjs/common';

import { Public } from '@app/authlib';

import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Public()
  @Get('live')
  live() {
    return this.healthService.live();
  }

  @Public()
  @Get('ready')
  ready() {
    return this.healthService.ready();
  }
}
