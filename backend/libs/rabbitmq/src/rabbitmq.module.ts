import { DynamicModule, Module, Provider } from '@nestjs/common';

import { getRabbitMqTransportToken } from './rabbitmq.constants';
import { RabbitMqClientLifecycle } from './rabbitmq.lifecycle';
import { getRabbitMqTransportProvider } from './rabbitmq.provider';
import { RabbitMqTransportOptions } from './rabbitmq.transport';

@Module({})
export class RabbitMqModule {
  static register(
    service: string,
    options: RabbitMqTransportOptions = {},
  ): DynamicModule {
    const transportProvider = getRabbitMqTransportProvider(service, options);
    const transportToken = getRabbitMqTransportToken(service);

    const lifecycleProvider: Provider = {
      provide: Symbol(`RABBITMQ_LIFECYCLE:${service}`),
      inject: [transportToken],
      useFactory: (transport) =>
        new RabbitMqClientLifecycle(transport, service),
    };

    return {
      module: RabbitMqModule,
      providers: [transportProvider, lifecycleProvider],
      exports: [transportToken],
    };
  }
}
