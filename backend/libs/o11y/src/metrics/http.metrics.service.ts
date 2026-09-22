import { Inject, Injectable } from '@nestjs/common';
import { Counter, Gauge, Histogram, Registry } from '@prometheus-io/client';

import { METRICS_REGISTRY } from './metrics.constants';

type HttpMetricLabel = 'method' | 'route' | 'status_code';

@Injectable()
export class HttpMetricsService {
  readonly httpRequestsTotal: Counter<HttpMetricLabel>;
  readonly httpRequestDuration: Histogram<HttpMetricLabel>;
  readonly httpRequestsInFlight: Gauge<never>;

  constructor(@Inject(METRICS_REGISTRY) private readonly registry: Registry) {
    this.httpRequestsTotal = new Counter<HttpMetricLabel>({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code'] as const,
      registers: [registry],
    });
    this.httpRequestDuration = new Histogram<HttpMetricLabel>({
      name: 'http_request_duration_seconds',
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'route', 'status_code'] as const,
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
      registers: [registry],
    });
    this.httpRequestsInFlight = new Gauge<never>({
      name: 'http_requests_in_flight',
      help: 'Number of HTTP requests currently being processed',
      registers: [registry],
    });
  }
}
