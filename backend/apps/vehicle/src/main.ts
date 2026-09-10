import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions } from '@nestjs/microservices';

import { getRabbitMqServerOptions } from '@app/rabbitmq';

import { VehicleModule } from './vehicle.module';

async function bootstrap() {
  const app = await NestFactory.create(VehicleModule);
  const configService = app.get(ConfigService);

  app.enableShutdownHooks();

  app.connectMicroservice<MicroserviceOptions>(
    getRabbitMqServerOptions(configService, 'vehicle'),
  );

  app.enableCors({
    origin: process.env.CORS_ORIGIN,
    credentials: true,
  });

  await app.startAllMicroservices();
  await app.listen(5001);
}
bootstrap();
