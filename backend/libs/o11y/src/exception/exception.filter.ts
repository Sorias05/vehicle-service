import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { PinoLogger } from 'nestjs-pino';

import { getRequestId } from './../request-context';

interface HttpRequest {
  method: string;
  url: string;
  route?: {
    path?: string;
  };
  id?: unknown;
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(
    private readonly httpAdapterHost: HttpAdapterHost,
    private readonly logger: PinoLogger,
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    if (host.getType() !== 'http') {
      throw exception;
    }

    const { httpAdapter } = this.httpAdapterHost;

    const ctx = host.switchToHttp();

    const request = ctx.getRequest<HttpRequest>();

    const response = ctx.getResponse();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const requestId =
      getRequestId() ??
      (typeof request.id === 'string' ? request.id : undefined);

    const route = request.route?.path ?? request.url;

    const logContext = {
      requestId,
      method: request.method,
      route,
      statusCode: status,
    };

    if (status >= 500) {
      this.logger.error(
        {
          ...logContext,
          err: exception,
        },
        'Unhandled exception',
      );
    } else {
      this.logger.warn(logContext, 'HTTP request failed');
    }

    const responseBody =
      exception instanceof HttpException
        ? exception.getResponse()
        : {
            statusCode: 500,
            message: 'Internal server error',
          };

    httpAdapter.reply(response, responseBody, status);
  }
}
