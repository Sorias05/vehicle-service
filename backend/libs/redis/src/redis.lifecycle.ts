import { Inject, Injectable, OnApplicationShutdown } from '@nestjs/common';
import type { RedisClientType } from 'redis';

import { REDIS_CLIENT } from './redis.constants';

@Injectable()
export class RedisClientLifecycle implements OnApplicationShutdown {
  constructor(
    @Inject(REDIS_CLIENT)
    private readonly client: RedisClientType,
  ) {}

  async onApplicationShutdown(): Promise<void> {
    if (!this.client.isOpen) {
      return;
    }

    await this.client.close();
  }
}
