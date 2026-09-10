import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { RedisStore } from 'connect-redis';
import * as session from 'express-session';

import { getRabbitMqServerOptions } from '@app/rabbitmq';

import { AuthModule } from './auth.module';
import { SESSION_STORE } from './session/session.provider';

async function bootstrap() {
  const app = await NestFactory.create(AuthModule);
  const configService = app.get(ConfigService);

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

bootstrap();
