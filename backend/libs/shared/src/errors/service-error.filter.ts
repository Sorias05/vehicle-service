import { ArgumentsHost, Catch, RpcExceptionFilter } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { Observable, throwError } from 'rxjs';

import { ServiceError } from '@app/shared';

@Catch(ServiceError)
export class ServiceErrorRpcFilter implements RpcExceptionFilter<ServiceError> {
  catch(exception: ServiceError, _host: ArgumentsHost): Observable<never> {
    return throwError(() => new RpcException(exception.toPayload()));
  }
}
