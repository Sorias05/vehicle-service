import {
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';

import { HEALTH_CHECKS } from './health.tokens';
import { HealthCheck, HealthCheckResult } from './health.types';

@Injectable()
export class HealthService {
  constructor(
    @Inject(HEALTH_CHECKS)
    private readonly checks: HealthCheck[],
  ) {}

  live() {
    return {
      status: 'ok',
    };
  }

  async ready() {
    const results = await Promise.all(
      this.checks.map((check) => this.runCheck(check)),
    );

    const healthy = results.every((result) => result.status === 'up');

    const response = {
      status: healthy ? 'ok' : 'error',
      checks: results,
    };

    if (!healthy) {
      throw new ServiceUnavailableException(response);
    }

    return response;
  }

  private async runCheck(check: HealthCheck): Promise<HealthCheckResult> {
    try {
      return await Promise.race([
        check.check(),

        new Promise<HealthCheckResult>((resolve) => {
          setTimeout(() => {
            resolve({
              name: check.name,
              status: 'down',
              message: 'Health check timeout',
            });
          }, 2000);
        }),
      ]);
    } catch {
      return {
        name: check.name,
        status: 'down',
        message: 'Health check failed',
      };
    }
  }
}
