import { Inject, Injectable } from '@nestjs/common';
import { Counter, Gauge, Histogram, Registry } from '@prometheus-io/client';

import { METRICS_REGISTRY } from './metrics.constants';

type RpcMetricLabel = 'target' | 'pattern' | 'status';

@Injectable()
export class RpcMetricsService {
  readonly clientRequestsTotal: Counter<RpcMetricLabel>;
  readonly clientRequestDuration: Histogram<RpcMetricLabel>;
  readonly clientRequestsInFlight: Gauge<never>;
  readonly handlerRequestsTotal: Counter<RpcMetricLabel>;
  readonly handlerDuration: Histogram<RpcMetricLabel>;
  readonly handlerRequestsInFlight: Gauge<never>;

  constructor(
    @Inject(METRICS_REGISTRY)
    registry: Registry,
  ) {
    this.clientRequestsTotal = new Counter<RpcMetricLabel>({
      name: 'rpc_client_requests_total',
      help: 'Total number of RPC client requests',
      labelNames: ['target', 'pattern', 'status'] as const,
      registers: [registry],
    });
    this.clientRequestDuration = new Histogram<RpcMetricLabel>({
      name: 'rpc_client_request_duration_seconds',
      help: 'RPC client request duration in seconds',
      labelNames: ['target', 'pattern', 'status'] as const,
      buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
      registers: [registry],
    });
    this.clientRequestsInFlight = new Gauge<never>({
      name: 'rpc_client_requests_in_flight',
      help: 'Number of RPC client requests currently being processed',
      registers: [registry],
    });
    this.handlerRequestsTotal = new Counter<RpcMetricLabel>({
      name: 'rpc_handler_requests_total',
      help: 'Total number of RPC handler executions',
      labelNames: ['target', 'pattern', 'status'] as const,
      registers: [registry],
    });
    this.handlerDuration = new Histogram<RpcMetricLabel>({
      name: 'rpc_handler_duration_seconds',
      help: 'RPC handler duration in seconds',
      labelNames: ['target', 'pattern', 'status'] as const,
      registers: [registry],
    });
    this.handlerRequestsInFlight = new Gauge<never>({
      name: 'rpc_handler_requests_in_flight',
      help: 'Number of RPC handlers currently being processed',
      registers: [registry],
    });
  }

  clientRequestStarted(): void {
    this.clientRequestsInFlight.inc();
  }

  clientRequestFinished(
    target: string,
    pattern: string,
    status: 'success' | 'error' | 'cancelled',
    durationSeconds: number,
  ): void {
    const labels = {
      target,
      pattern,
      status,
    };

    this.clientRequestsTotal.inc(labels);
    this.clientRequestDuration.observe(labels, durationSeconds);
    this.clientRequestsInFlight.dec();
  }

  handlerRequestStarted(): void {
    this.handlerRequestsInFlight.inc();
  }

  handlerRequestFinished(
    target: string,
    pattern: string,
    status: 'success' | 'error',
    durationSeconds: number,
  ): void {
    const labels = {
      target,
      pattern,
      status,
    };

    this.handlerRequestsTotal.inc(labels);
    this.handlerDuration.observe(labels, durationSeconds);
    this.handlerRequestsInFlight.dec();
  }
}
