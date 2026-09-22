import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { RedisStore } from 'connect-redis';
import * as session from 'express-session';

import { setupO11y } from '@app/o11y';
import { getRabbitMqServerOptions } from '@app/rabbitmq';

import { AuthModule } from './auth.module';
import { SESSION_STORE } from './session/session.provider';

async function bootstrap() {
  const app = await NestFactory.create(AuthModule, {
    bufferLogs: true,
  });
  const configService = app.get(ConfigService);

  setupO11y(app);

  app.enableShutdownHooks();
  app.connectMicroservice(getRabbitMqServerOptions(configService, 'auth'));

  const redisStore = app.get<RedisStore>(SESSION_STORE);

  app.use(
    session({
      store: redisStore,
      secret: configService.getOrThrow<string>('SESSION_SECRET'),
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        maxAge: 1000 * 60 * 60,
      },
    }),
  );

  app.enableCors({
    origin: process.env.CORS_ORIGIN,
    credentials: true,
  });

  await app.startAllMicroservices();
  await app.listen(5002);
}

bootstrap().catch((error) => {
  console.error('Application bootstrap failed:', error);
  process.exit(1);
});
