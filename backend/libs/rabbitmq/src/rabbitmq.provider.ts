import { InjectionToken, Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ClientProxy,
  ClientProxyFactory,
  RmqRecordBuilder,
} from '@nestjs/microservices';
import { defer, finalize, tap } from 'rxjs';

import { getRabbitMqServiceToken } from './rabbitmq.constants';
import { getRabbitMqServerOptions } from './rabbitmq.options';

interface RpcMetricsSink {
  clientRequestStarted(): void;
  clientRequestFinished(
    target: string,
    pattern: string,
    status: 'success' | 'error' | 'cancelled',
    durationSeconds: number,
  ): void;
}

export interface RabbitMqClientProviderOptions {
  requestIdProvider?: () => string | undefined;
  rpcMetricsToken?: InjectionToken;
}

export function getRabbitMqClientProvider(
  service: string,
  options: RabbitMqClientProviderOptions = {},
): Provider {
  const inject: InjectionToken[] = [ConfigService];

  if (options.rpcMetricsToken) {
    inject.push(options.rpcMetricsToken);
  }

  return {
    provide: getRabbitMqServiceToken(service),
    inject,
    useFactory: (configService: ConfigService, metrics?: RpcMetricsSink) => {
      const client = ClientProxyFactory.create(
        getRabbitMqServerOptions(configService, service),
      );

      return createInstrumentedClient(
        client,
        service,
        options.requestIdProvider,
        metrics,
      );
    },
  };
}

function createInstrumentedClient(
  client: ClientProxy,
  target: string,
  requestIdProvider: (() => string | undefined) | undefined,
  metrics: RpcMetricsSink | undefined,
): ClientProxy {
  return new Proxy(client, {
    get(targetClient, property) {
      if (property === 'send') {
        return (pattern: unknown, data: unknown) => {
          const requestId = requestIdProvider?.();
          const payload = requestId
            ? new RmqRecordBuilder(data)
                .setOptions({
                  headers: {
                    'x-request-id': requestId,
                  },
                })
                .build()
            : data;
          const patternName = getPatternName(pattern);

          if (!metrics) {
            return targetClient.send(pattern, payload);
          }

          return defer(() => {
            const startedAt = process.hrtime.bigint();
            let status: 'success' | 'error' | 'cancelled' = 'cancelled';
            metrics.clientRequestStarted();
            return targetClient.send(pattern, payload).pipe(
              tap({
                complete: () => {
                  status = 'success';
                },

                error: () => {
                  status = 'error';
                },
              }),

              finalize(() => {
                const duration =
                  Number(process.hrtime.bigint() - startedAt) / 1_000_000_000;

                metrics.clientRequestFinished(
                  target,
                  patternName,
                  status,
                  duration,
                );
              }),
            );
          });
        };
      }

      const value = Reflect.get(targetClient, property, targetClient);
      return typeof value === 'function' ? value.bind(targetClient) : value;
    },
  }) as ClientProxy;
}

function getPatternName(pattern: unknown): string {
  if (typeof pattern === 'string') {
    return pattern;
  }

  if (
    pattern &&
    typeof pattern === 'object' &&
    'cmd' in pattern &&
    typeof pattern.cmd === 'string'
  ) {
    return pattern.cmd;
  }

  return 'unknown';
}
