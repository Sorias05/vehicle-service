import { Inject, Injectable } from '@nestjs/common';
import { RedisStore } from 'connect-redis';
import { parse } from 'cookie';
import * as signature from 'cookie-signature';

import { SESSION_STORE } from './session.provider';

@Injectable()
export class SessionService {
  constructor(
    @Inject(SESSION_STORE)
    private readonly store: RedisStore,
  ) {}

  async get(sessionId: string) {
    return this.store.get(sessionId);
  }

  async validate(cookieHeader?: string) {
    if (!cookieHeader) {
      return {
        authenticated: false,
        userId: null,
      };
    }

    const cookies = parse(cookieHeader);
    const rawSessionCookie = cookies['connect.sid'];

    if (!rawSessionCookie) {
      return {
        authenticated: false,
        userId: null,
      };
    }

    const decoded = decodeURIComponent(rawSessionCookie);

    if (!decoded.startsWith('s:')) {
      return {
        authenticated: false,
        userId: null,
      };
    }

    const signedValue = decoded.slice(2);

    const sessionId = signature.unsign(
      signedValue,
      process.env.SESSION_SECRET!,
    );

    if (!sessionId) {
      return {
        authenticated: false,
        userId: null,
      };
    }

    const session = await this.store.get(sessionId);

    if (!session?.userId) {
      return {
        authenticated: false,
        userId: null,
      };
    }

    return {
      authenticated: true,
      userId: session.userId,
    };
  }
}
