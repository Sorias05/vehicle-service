import { Provider } from '@nestjs/common';
import { RedisStore } from 'connect-redis';

import { REDIS_CLIENT } from '@app/redis';

export const SESSION_STORE = 'SESSION_STORE';

export const sessionStoreProvider: Provider = {
  provide: SESSION_STORE,
  inject: [REDIS_CLIENT],
  useFactory: (redisClient) => {
    return new RedisStore({
      client: redisClient,
    });
  },
};
