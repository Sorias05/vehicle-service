import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { finalize, Observable, tap } from 'rxjs';

import { RpcMetricsService } from './rpc.metrics.service';

@Injectable()
export class RpcMetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: RpcMetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'rpc') {
      return next.handle();
    }

    const handler = context.getHandler().name;
    const target = context.getClass().name;
    const start = process.hrtime.bigint();
    let status: 'success' | 'error' = 'success';
    this.metrics.handlerRequestStarted();

    return next.handle().pipe(
      tap({
        error: () => {
          status = 'error';
        },
      }),

      finalize(() => {
        const duration =
          Number(process.hrtime.bigint() - start) / 1_000_000_000;
        this.metrics.handlerRequestFinished(target, handler, status, duration);
      }),
    );
  }
}
