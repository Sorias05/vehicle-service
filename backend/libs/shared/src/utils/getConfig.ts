import { DynamicModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

export async function getConfig(): Promise<DynamicModule> {
  return ConfigModule.forRoot({
    isGlobal: true,
    envFilePath: '.env',
  });
}
