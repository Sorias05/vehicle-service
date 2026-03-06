import { ConfigService } from '@nestjs/config';
import { ClientProxyFactory, Transport } from '@nestjs/microservices';

export function getService(name: string) {
  return {
    provide: `${name.toUpperCase()}_SERVICE`,
    useFactory: (configService: ConfigService) => {
      const USER = configService.get('RABBITMQ_USER');
      const PASSWORD = configService.get('RABBITMQ_PASS');
      const HOST = configService.get('RABBITMQ_HOST');
      const QUEUE = configService.get(`RABBITMQ_${name.toUpperCase()}_QUEUE`);

      return ClientProxyFactory.create({
        transport: Transport.RMQ,
        options: {
          urls: [`amqp://${USER}:${PASSWORD}@${HOST}`],
          queue: QUEUE,
          queueOptions: {
            durable: true,
          },
          socketOptions: {
            heartbeatIntervalInSeconds: 5,
            reconnectTimeInSeconds: 5,
          },
        },
      });
    },
    inject: [ConfigService],
  };
}
