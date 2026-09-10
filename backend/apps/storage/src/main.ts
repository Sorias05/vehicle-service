import { NestFactory } from '@nestjs/core';

import { StorageModule } from './storage.module';

async function bootstrap() {
  const app = await NestFactory.create(StorageModule);
  app.enableShutdownHooks();
  await app.listen(5003);
}
bootstrap();
