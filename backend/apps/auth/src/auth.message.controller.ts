import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';

import { SessionService } from './session/session.service';

@Controller()
export class AuthMessageController {
  constructor(private readonly sessionService: SessionService) {}

  @MessagePattern({
    cmd: 'auth.validate-session',
  })
  validateSession(
    @Payload()
    payload: {
      cookie?: string;
    },
  ) {
    return this.sessionService.validate(payload.cookie);
  }

  @MessagePattern({ cmd: 'health' })
  health() {
    return {
      status: 'up',
    };
  }
}
