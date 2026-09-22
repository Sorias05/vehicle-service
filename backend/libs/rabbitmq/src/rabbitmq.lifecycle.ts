import { OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';

export class RabbitMqClientLifecycle
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  constructor(
    private readonly client: ClientProxy,
    private readonly service: string,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    try {
      await this.client.connect();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : JSON.stringify(error);

      throw new Error(
        `RabbitMQ connection failed for "${this.service}": ${message}`,
      );
    }
  }

  async onApplicationShutdown(): Promise<void> {
    await this.client.close();
  }
}
