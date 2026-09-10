import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientProxyFactory } from '@nestjs/microservices';

import { getRabbitMqServiceToken } from './rabbitmq.constants';
import { getRabbitMqServerOptions } from './rabbitmq.options';

export function getRabbitMqClientProvider(name: string): Provider {
  return {
    provide: getRabbitMqServiceToken(name),
    useFactory: (configService: ConfigService) => {
      const options = getRabbitMqServerOptions(configService, name);
      return ClientProxyFactory.create(options);
    },
    inject: [ConfigService],
  };
}
