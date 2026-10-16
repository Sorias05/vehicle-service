import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions } from '@nestjs/microservices';

import { setupO11y } from '@app/o11y';
import { getRabbitMqServerOptions } from '@app/rabbitmq';
import { ServiceErrorRpcFilter } from '@app/shared';

import { VehicleModule } from './vehicle.module';

async function bootstrap() {
  const app = await NestFactory.create(VehicleModule, {
    bufferLogs: true,
  });
  const configService = app.get(ConfigService);

  setupO11y(app);

  app.enableShutdownHooks();
  const microservice = app.connectMicroservice<MicroserviceOptions>(
    getRabbitMqServerOptions(configService, 'vehicle'),
  );

  microservice.useGlobalFilters(new ServiceErrorRpcFilter());

  app.enableCors({
    origin: configService.getOrThrow<string>('CORS_ORIGIN'),
    credentials: true,
  });

  await app.startAllMicroservices();
  await app.listen(5001);
}

bootstrap().catch((error) => {
  console.error('Application bootstrap failed:', error);
  process.exit(1);
});
