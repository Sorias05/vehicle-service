import { Provider } from '@nestjs/common';

import { HEALTH_CHECK_MAP } from './checks';
import { HEALTH_CHECKS } from './health.tokens';
import { HealthCheck, HealthDependency } from './health.types';

export function createHealthProviders(
  dependencies: HealthDependency[],
): Provider[] {
  const checkers = dependencies.map(
    (dependency) => HEALTH_CHECK_MAP[dependency],
  );

  return [
    ...checkers,
    {
      provide: HEALTH_CHECKS,
      inject: checkers,
      useFactory: (...instances: HealthCheck[]): HealthCheck[] => instances,
    },
  ];
}
