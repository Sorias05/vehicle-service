import { DynamicModule, Module } from '@nestjs/common';

import { getRabbitMqClientProvider } from './rabbitmq.provider';

@Module({})
export class RabbitMqModule {
  static register(service: string): DynamicModule {
    const provider = getRabbitMqClientProvider(service);

    return {
      module: RabbitMqModule,
      providers: [provider],
      exports: [provider],
    };
  }

  static registerAuth(): DynamicModule {
    return this.register('auth');
  }
}
