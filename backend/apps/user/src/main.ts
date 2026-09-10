import { NestFactory } from '@nestjs/core';

import { UserModule } from './user.module';

async function bootstrap() {
  const app = await NestFactory.create(UserModule);
  app.enableShutdownHooks();
  app.enableCors({
    origin: process.env.CORS_ORIGIN,
    credentials: true,
  });
  await app.listen(5000);
}

bootstrap();
