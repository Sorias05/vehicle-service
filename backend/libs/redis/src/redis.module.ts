import { Global, Module } from '@nestjs/common';

import { REDIS_CLIENT } from './redis.constants';
import { RedisClientLifecycle } from './redis.lifecycle';
import { redisClientProvider } from './redis.provider';

@Global()
@Module({
  providers: [redisClientProvider, RedisClientLifecycle],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
