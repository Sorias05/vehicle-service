import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from 'redis';

import { REDIS_CLIENT } from './redis.constants';

export const redisClientProvider: Provider = {
  provide: REDIS_CLIENT,
  inject: [ConfigService],
  useFactory: async (configService: ConfigService) => {
    const host = configService.getOrThrow<string>('REDIS_HOST');
    const port = configService.getOrThrow<string>('REDIS_PORT');

    const client = createClient({
      url: `redis://${host}:${port}`,
    });

    client.on('error', (error) => {
      console.error('Redis error:', error);
    });

    await client.connect();

    return client;
  },
};
