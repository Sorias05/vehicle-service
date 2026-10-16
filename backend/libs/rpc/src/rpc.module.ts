import {
  DynamicModule,
  InjectionToken,
  Module,
  ModuleMetadata,
  Provider,
} from '@nestjs/common';

import { RpcClient, RpcMetricsSink } from './rpc.client';
import { getRpcClientToken } from './rpc.constants';
import { RpcResilienceBuilder, RpcTransport } from './rpc.types';

export interface RpcModuleOptions {
  target: string;
  transportModule: DynamicModule;
  transportToken: InjectionToken;
  requestTimeoutMs?: number;
  rpcMetricsToken?: InjectionToken;
  resilienceBuilder?: RpcResilienceBuilder;
  imports?: ModuleMetadata['imports'];
}

@Module({})
export class RpcModule {
  static register(options: RpcModuleOptions): DynamicModule {
    const clientToken = getRpcClientToken(options.target);

    const inject: InjectionToken[] = [options.transportToken];

    if (options.rpcMetricsToken) {
      inject.push(options.rpcMetricsToken);
    }

    const clientProvider: Provider = {
      provide: clientToken,
      inject,

      useFactory: (transport: RpcTransport, metrics?: RpcMetricsSink) =>
        new RpcClient(
          transport,
          {
            target: options.target,
            requestTimeoutMs: options.requestTimeoutMs,
            resilienceBuilder: options.resilienceBuilder,
          },
          metrics,
        ),
    };

    return {
      module: RpcModule,
      imports: [...(options.imports ?? []), options.transportModule],
      providers: [clientProvider],
      exports: [clientToken],
    };
  }
}
