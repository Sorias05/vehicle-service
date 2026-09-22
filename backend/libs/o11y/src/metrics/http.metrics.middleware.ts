import { NextFunction, Request, Response } from 'express';

import { HttpMetricsService } from './http.metrics.service';

const IGNORED_PATHS = new Set(['/metrics', '/health/live', '/health/ready']);

export function HttpMetricsMiddleware(metrics: HttpMetricsService) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (IGNORED_PATHS.has(req.path)) {
      next();
      return;
    }

    const start = process.hrtime.bigint();
    metrics.httpRequestsInFlight.inc();
    let recorded = false;

    const record = () => {
      if (recorded) {
        return;
      }

      recorded = true;
      const duration = Number(process.hrtime.bigint() - start) / 1_000_000_000;
      const route = req.route?.path ?? 'unknown';
      const statusCode = String(res.statusCode);
      const labels = {
        method: req.method,
        route,
        status_code: statusCode,
      };

      metrics.httpRequestsTotal.inc(labels);
      metrics.httpRequestDuration.observe(labels, duration);
      metrics.httpRequestsInFlight.dec();
    };

    res.once('finish', record);
    res.once('close', () => {
      if (!res.writableFinished) {
        record();
      }
    });
    next();
  };
}
