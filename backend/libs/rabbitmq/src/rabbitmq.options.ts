import { ConfigService } from '@nestjs/config';
import { RmqOptions, Transport } from '@nestjs/microservices';

export function getRabbitMqServerOptions(
  configService: ConfigService,
  queue: string,
): RmqOptions {
  const USER = configService.getOrThrow<string>('RABBITMQ_USER');
  const PASSWORD = configService.getOrThrow<string>('RABBITMQ_PASS');
  const HOST = configService.getOrThrow<string>('RABBITMQ_HOST');
  const PORT = configService.getOrThrow<string>('RABBITMQ_PORT');

  return {
    transport: Transport.RMQ,
    options: {
      urls: [`amqp://${USER}:${PASSWORD}@${HOST}:${PORT}`],
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
