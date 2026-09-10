import { DynamicModule, Module } from '@nestjs/common';

import { HealthController } from './health.controller';
import { createHealthProviders } from './health.providers';
import { HealthService } from './health.service';
import { HealthDependency } from './health.types';

@Module({})
export class HealthModule {
  static register(dependencies: HealthDependency[] = []): DynamicModule {
    return {
      module: HealthModule,
      controllers: [HealthController],
      providers: [HealthService, ...createHealthProviders(dependencies)],
    };
  }
}
