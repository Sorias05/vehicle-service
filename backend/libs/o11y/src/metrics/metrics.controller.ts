import { Controller, Get, Header } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { Registry } from '@prometheus-io/client';

import { Public } from '@app/authlib';

import { METRICS_REGISTRY } from './metrics.constants';

@Controller('metrics')
export class MetricsController {
  constructor(
    @Inject(METRICS_REGISTRY)
    private readonly registry: Registry,
  ) {}

  @Public()
  @Get()
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  async metrics(): Promise<string> {
    return this.registry.metrics();
  }
}
