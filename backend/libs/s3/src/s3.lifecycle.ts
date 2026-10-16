import { S3Client } from '@aws-sdk/client-s3';
import { Inject, Injectable, OnApplicationShutdown } from '@nestjs/common';

import { S3_CLIENT } from './s3.constants';

@Injectable()
export class S3ClientLifecycle implements OnApplicationShutdown {
  constructor(
    @Inject(S3_CLIENT)
    private readonly client: S3Client,
  ) {}

  onApplicationShutdown(): void {
    this.client.destroy();
  }
}
