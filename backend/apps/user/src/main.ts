import { NestFactory } from '@nestjs/core';

import { setupO11y } from '@app/o11y';

import { UserModule } from './user.module';

async function bootstrap() {
  const app = await NestFactory.create(UserModule, {
    bufferLogs: true,
  });
  setupO11y(app);
  app.enableShutdownHooks();
  app.enableCors({
    origin: process.env.CORS_ORIGIN,
    credentials: true,
  });
  await app.listen(5000);
}

bootstrap().catch((error) => {
  console.error('Application bootstrap failed:', error);
  process.exit(1);
});
