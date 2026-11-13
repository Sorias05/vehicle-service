import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from 'redis';

import { REDIS_CLIENT } from './redis.constants';

export const redisClientProvider: Provider = {
  provide: REDIS_CLIENT,
  inject: [ConfigService],
  useFactory: async (configService: ConfigService) => {
    const url = configService.getOrThrow<string>('REDIS_URL');

    const client = createClient({
      url,
    });

    client.on('error', (error) => {
      console.error('Redis error:', error);
    });

    await client.connect();

    return client;
  },
};
