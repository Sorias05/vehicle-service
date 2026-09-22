import { DynamicModule, Global, Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { collectDefaultMetrics, Registry } from '@prometheus-io/client';
import { LoggerModule } from 'nestjs-pino';

import { GlobalExceptionFilter } from './exception/exception.filter';
import { HttpMetricsService } from './metrics/http.metrics.service';
import { METRICS_REGISTRY, RPC_METRICS } from './metrics/metrics.constants';
import { MetricsController } from './metrics/metrics.controller';
import { RpcMetricsInterceptor } from './metrics/rpc.metrics.interceptor';
import { RpcMetricsService } from './metrics/rpc.metrics.service';
import { createO11yConfig } from './o11y.config';
import { TracingLifecycle } from './tracing/lifecycle';

@Global()
@Module({})
export class O11yModule {
  static register(serviceName: string): DynamicModule {
    const registry = new Registry();
    registry.setDefaultLabels({
      service: serviceName,
    });
    collectDefaultMetrics({
      register: registry,
    });

    return {
      module: O11yModule,
      imports: [LoggerModule.forRoot(createO11yConfig(serviceName))],
      controllers: [MetricsController],
      providers: [
        {
          provide: METRICS_REGISTRY,
          useValue: registry,
        },
        HttpMetricsService,
        RpcMetricsService,
        {
          provide: RPC_METRICS,
          useExisting: RpcMetricsService,
        },
        {
          provide: APP_INTERCEPTOR,
          useClass: RpcMetricsInterceptor,
        },
        {
          provide: APP_FILTER,
          useClass: GlobalExceptionFilter,
        },
        TracingLifecycle,
      ],
      exports: [HttpMetricsService, RpcMetricsService, RPC_METRICS],
    };
  }
}
