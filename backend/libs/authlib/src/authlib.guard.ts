import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';

import { IS_PUBLIC_KEY } from './authlib.decorators';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject('AUTH_SERVICE')
    private readonly authService: ClientProxy,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const cookie = request.headers.cookie;

    const result = await firstValueFrom(
      this.authService.send({ cmd: 'auth.validate-session' }, { cookie }),
    );

    if (!result.authenticated) {
      throw new UnauthorizedException();
    }

    request.user = {
      id: result.userId,
    };

    return true;
  }
}

// @Injectable()
// export class AuthGuard implements CanActivate {
//   constructor(
//     @Inject('AUTH_SERVICE')
//     private readonly authService: ClientProxy,
//   ) {}

//   async canActivate(context: ExecutionContext): Promise<boolean> {
//     const request = context.switchToHttp().getRequest();
//     const cookie = request.headers.cookie;

//     const result = await firstValueFrom(
//       this.authService.send({ cmd: 'auth.validate-session' }, { cookie }),
//     );

//     if (!result.authenticated) {
//       throw new UnauthorizedException();
//     }

//     request.user = {
//       id: result.userId,
//     };

//     return true;
//   }
// }
