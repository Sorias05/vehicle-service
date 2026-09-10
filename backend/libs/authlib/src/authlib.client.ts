import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class AuthClient {
  constructor(
    @Inject('AUTH_SERVICE')
    private readonly authClient: ClientProxy,
  ) {}

  async validateSession(sessionId?: string) {
    const result = await firstValueFrom(
      this.authClient.send({ cmd: 'auth.validate-session' }, { sessionId }),
    );

    if (!result?.authenticated || !result.userId) {
      throw new UnauthorizedException();
    }

    return {
      id: result.userId,
    };
  }
}
