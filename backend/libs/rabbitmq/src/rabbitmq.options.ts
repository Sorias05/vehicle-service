import { ConfigService } from '@nestjs/config';
import { RmqOptions, Transport } from '@nestjs/microservices';

export function getRabbitMqServerOptions(
  configService: ConfigService,
  queue: string,
): RmqOptions {
  const URL = configService.getOrThrow<string>('RABBITMQ_URL');

  return {
    transport: Transport.RMQ,
    options: {
      urls: [URL],
      noAck: true,
      queue: `${queue}_queue`,
      queueOptions: {
        durable: true,
      },
      socketOptions: {
        heartbeatIntervalInSeconds: 5,
        reconnectTimeInSeconds: 5,
      },
    },
  };
}
