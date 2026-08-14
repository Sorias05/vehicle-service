import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { createClient } from 'redis';
import { RedisStore } from 'connect-redis';
import * as session from 'express-session';
import { UserModule } from './user.module';

async function bootstrap() {
  const app = await NestFactory.create(UserModule);
  const configService = app.get(ConfigService);

  const HOST = configService.get('REDIS_HOST');
  const PORT = configService.get('REDIS_PORT');

  const redisClient = createClient({
    url: `redis://${HOST}:${PORT}`,
  });

  await redisClient.connect();

  const redisStore = new RedisStore({
    client: redisClient,
  });

  app.use(
    session({
      store: redisStore,
      secret: 'super-secret-key',
      resave: false,
      saveUninitialized: false,
      cookie: {
        maxAge: 1000 * 60 * 60,
      },
    }),
  );

  app.enableCors({
    origin: process.env.CORS_ORIGIN,
    credentials: true,
  });

  await app.listen(5000);
}
bootstrap();
