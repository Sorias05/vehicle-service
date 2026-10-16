import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';

import { getRpcClientToken, RpcClient } from '@app/rpc';

import { ValidateSessionResponse } from './authlib.types';

@Injectable()
export class AuthClient {
  constructor(
    @Inject(getRpcClientToken('auth'))
    private readonly authRpc: RpcClient,
  ) {}

  async validateSession(sessionId?: string) {
    const result = await firstValueFrom(
      this.authRpc.send<ValidateSessionResponse>(
        { cmd: 'auth.validate-session' },
        { sessionId },
        { idempotent: true },
      ),
    );

    if (!result?.authenticated || !result.userId) {
      throw new UnauthorizedException();
    }

    return {
      id: result.userId,
    };
  }
}
