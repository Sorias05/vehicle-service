import { INestApplication } from '@nestjs/common';
import { Logger } from 'nestjs-pino';

import { HttpMetricsMiddleware } from './metrics/http.metrics.middleware';
import { HttpMetricsService } from './metrics/http.metrics.service';
import { requestContext } from './request-context';

export function setupO11y(app: INestApplication): void {
  app.useLogger(app.get(Logger));
  app.use((req, _res, next) => {
    const requestId = getRequestIdFromRequest(req);

    if (!requestId) {
      next();
      return;
    }

    requestContext.run(requestId, () => next());
  });

  const httpMetricsService = app.get(HttpMetricsService);
  app.use(HttpMetricsMiddleware(httpMetricsService));
}

function getRequestIdFromRequest(req: { id?: unknown }): string | undefined {
  return typeof req.id === 'string' ? req.id : undefined;
}
