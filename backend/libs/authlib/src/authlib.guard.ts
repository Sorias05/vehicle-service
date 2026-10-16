import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { firstValueFrom } from 'rxjs';

import { getRpcClientToken, RpcClient } from '@app/rpc';

import { IS_PUBLIC_KEY } from './authlib.decorators';
import { ValidateSessionResponse } from './authlib.types';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(getRpcClientToken('auth'))
    private readonly authRpc: RpcClient,
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
      this.authRpc.send<ValidateSessionResponse>(
        { cmd: 'auth.validate-session' },
        { cookie },
        { idempotent: true },
      ),
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
