import { Provider } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';

import { AuthGuard } from './authlib.guard';

export const authGuardProvider: Provider = {
  provide: APP_GUARD,
  useClass: AuthGuard,
};
