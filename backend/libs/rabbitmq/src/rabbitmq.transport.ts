import { ClientProxy, RmqRecordBuilder } from '@nestjs/microservices';
import { Observable } from 'rxjs';

import type { RpcPattern, RpcTransport } from '@app/rpc';

export interface RabbitMqTransportOptions {
  requestIdProvider?: () => string | undefined;
}

export class RabbitMqTransport implements RpcTransport {
  constructor(
    private readonly client: ClientProxy,
    private readonly options: RabbitMqTransportOptions = {},
  ) {}

  send<TResponse = unknown>(
    pattern: RpcPattern,
    data: unknown,
  ): Observable<TResponse> {
    const requestId = this.options.requestIdProvider?.();

    const payload = requestId
      ? new RmqRecordBuilder(data)
          .setOptions({
            headers: {
              'x-request-id': requestId,
            },
          })
          .build()
      : data;

    return this.client.send<TResponse, unknown>(pattern, payload);
  }

  async connect(): Promise<void> {
    await this.client.connect();
  }

  close(): void {
    this.client.close();
  }
}
