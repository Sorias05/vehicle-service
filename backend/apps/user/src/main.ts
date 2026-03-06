import { NestFactory } from '@nestjs/core';
import { createClient } from 'redis';
import { RedisStore } from 'connect-redis';
import * as session from 'express-session';
import { UserModule } from './user.module';

async function bootstrap() {
  const app = await NestFactory.create(UserModule);

  const redisClient = createClient({
    url: 'redis://redis:6379',
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

  await app.listen(5000);
}
bootstrap();
