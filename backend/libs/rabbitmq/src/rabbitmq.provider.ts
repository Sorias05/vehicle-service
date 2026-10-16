import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientProxyFactory } from '@nestjs/microservices';

import { RpcTransport } from '@app/rpc';

import { getRabbitMqTransportToken } from './rabbitmq.constants';
import { getRabbitMqServerOptions } from './rabbitmq.options';
import {
  RabbitMqTransport,
  RabbitMqTransportOptions,
} from './rabbitmq.transport';

export function getRabbitMqTransportProvider(
  service: string,
  options: RabbitMqTransportOptions = {},
): Provider {
  return {
    provide: getRabbitMqTransportToken(service),
    inject: [ConfigService],

    useFactory: (configService: ConfigService): RpcTransport => {
      const client = ClientProxyFactory.create(
        getRabbitMqServerOptions(configService, service),
      );

      return new RabbitMqTransport(client, options);
    },
  };
}
