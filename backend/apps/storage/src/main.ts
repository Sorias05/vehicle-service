import { NestFactory } from '@nestjs/core';

import { setupO11y } from '@app/o11y';

import { StorageModule } from './storage.module';

async function bootstrap() {
  const app = await NestFactory.create(StorageModule, {
    bufferLogs: true,
  });
  setupO11y(app);
  app.enableShutdownHooks();
  await app.listen(5003);
}

bootstrap().catch((error) => {
  console.error('Application bootstrap failed:', error);
  process.exit(1);
});
