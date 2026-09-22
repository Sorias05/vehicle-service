import { DynamicModule, Module, Provider } from '@nestjs/common';

import { getRabbitMqServiceToken } from './rabbitmq.constants';
import { RabbitMqClientLifecycle } from './rabbitmq.lifecycle';
import {
  getRabbitMqClientProvider,
  RabbitMqClientProviderOptions,
} from './rabbitmq.provider';

@Module({})
export class RabbitMqModule {
  static register(
    service: string,
    options?: RabbitMqClientProviderOptions,
  ): DynamicModule {
    const provider: Provider = getRabbitMqClientProvider(service, options);

    const lifecycleProvider: Provider = {
      provide: Symbol(`RABBITMQ_LIFECYCLE:${service}`),
      inject: [getRabbitMqServiceToken(service)],
      useFactory: (client) => new RabbitMqClientLifecycle(client, service),
    };

    return {
      module: RabbitMqModule,
      providers: [provider, lifecycleProvider],
      exports: [provider],
    };
  }

  static registerAuth(options?: RabbitMqClientProviderOptions): DynamicModule {
    return this.register('auth', options);
  }
}
