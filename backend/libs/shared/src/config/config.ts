import { DynamicModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { validate } from './env.validation';

export async function getConfig(): Promise<DynamicModule> {
  return ConfigModule.forRoot({
    isGlobal: true,
    envFilePath: '.env',
    validate,
  });
}
