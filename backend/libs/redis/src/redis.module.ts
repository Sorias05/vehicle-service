import { Global, Module } from '@nestjs/common';

import { redisClientProvider } from './redis.provider';

@Global()
@Module({
  providers: [redisClientProvider],
  exports: [redisClientProvider],
})
export class RedisModule {}
