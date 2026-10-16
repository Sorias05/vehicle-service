import { DynamicModule, Module } from '@nestjs/common';

import { getConfig } from './config/config';

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
}
