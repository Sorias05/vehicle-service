import { Global, Module } from '@nestjs/common';

import { S3_CLIENT } from './s3.constants';
import { S3ClientLifecycle } from './s3.lifecycle';
import { s3ClientProvider } from './s3.provider';

@Global()
@Module({
  providers: [s3ClientProvider, S3ClientLifecycle],
  exports: [S3_CLIENT],
})
export class S3Module {}
