import { DynamicModule, Module } from '@nestjs/common';
import { getService } from './utils/getService';
import { getConfig } from './utils/getConfig';

@Module({})
export class SharedModule {
  static async registerConfig(): Promise<DynamicModule> {
    const config = await getConfig();

    return {
      module: SharedModule,
      imports: [config],
      exports: [config],
    };
  }

  static registerRmq(service: string): DynamicModule {
    const serviceProvider = getService(service);

    return {
      module: SharedModule,
      providers: [serviceProvider],
      exports: [serviceProvider],
    };
  }
}
