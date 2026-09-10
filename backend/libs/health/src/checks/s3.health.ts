import { HeadBucketCommand, S3Client } from '@aws-sdk/client-s3';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ModuleRef } from '@nestjs/core';

import { S3_CLIENT } from '@app/s3';

import { HealthCheck, HealthCheckResult } from '../health.types';

@Injectable()
export class S3HealthCheck implements HealthCheck {
  readonly name = 's3' as const;

  constructor(private readonly moduleRef: ModuleRef) {}

  async check(): Promise<HealthCheckResult> {
    try {
      const client = this.moduleRef.get<S3Client>(S3_CLIENT, { strict: false });

      const config = this.moduleRef.get<ConfigService>(ConfigService, {
        strict: false,
      });

      const bucket = config.getOrThrow<string>('AWS_S3_BUCKET');

      await client.send(
        new HeadBucketCommand({
          Bucket: bucket,
        }),
      );

      return {
        name: this.name,
        status: 'up',
      };
    } catch {
      return {
        name: this.name,
        status: 'down',
        message: 'S3 is unavailable',
      };
    }
  }
}
