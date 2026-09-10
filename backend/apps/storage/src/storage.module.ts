import { Module } from '@nestjs/common';

import { authGuardProvider } from '@app/authlib';
import { DatabaseModule } from '@app/database';
import { FileEntity } from '@app/database/entities/file.entity';
import { HealthModule } from '@app/health';
import { RabbitMqModule } from '@app/rabbitmq';
import { S3Module } from '@app/s3';
import { SharedModule } from '@app/shared';

import { StorageController } from './storage.controller';
import { StorageService } from './storage.service';

@Module({
  imports: [
    SharedModule.registerConfig(),
    RabbitMqModule.registerAuth(),
    DatabaseModule.register([FileEntity]),
    S3Module,
    HealthModule.register(['postgres', 's3', 'rabbitmq', 'auth']),
  ],
  controllers: [StorageController],
  providers: [StorageService, authGuardProvider],
})
export class StorageModule {}
