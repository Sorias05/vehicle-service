import { Params } from 'nestjs-pino';
import { randomUUID } from 'node:crypto';
import { IncomingMessage, ServerResponse } from 'node:http';

import { getRequestId } from './request-context';

function getRequestIdFromHttp(
  req: IncomingMessage,
  res: ServerResponse<IncomingMessage>,
): string {
  const header = req.headers['x-request-id'];

  if (
    typeof header === 'string' &&
    header.length > 0 &&
    header.length <= 128 &&
    /^[a-zA-Z0-9._:-]+$/.test(header)
  ) {
    res.setHeader('X-Request-Id', header);
    return header;
  }

  const requestId = randomUUID();
  res.setHeader('X-Request-Id', requestId);
  return requestId;
}

export function createO11yConfig(serviceName: string): Params {
  return {
    pinoHttp: {
      genReqId: getRequestIdFromHttp,
      mixin: () => {
        const requestId = getRequestId();
        return requestId ? { requestId } : {};
      },
      customProps: () => ({
        service: serviceName,
      }),
      autoLogging: {
        ignore: (req) => {
          return (
            req.url === '/health/live' ||
            req.url === '/health/ready' ||
            req.url === '/metrics'
          );
        },
      },
      customLogLevel: (_req, res, err) => {
        if (err || res.statusCode >= 500) {
          return 'error';
        }
        if (res.statusCode >= 400) {
          return 'warn';
        }
        return 'info';
      },
      redact: {
        paths: [
          'req.headers.authorization',
          'req.headers.cookie',
          'res.headers["set-cookie"]',
        ],
        remove: true,
      },
    },
  };
}
