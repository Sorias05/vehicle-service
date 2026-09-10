import { Global, Module } from '@nestjs/common';

import { s3ClientProvider } from './s3.provider';

@Global()
@Module({
  providers: [s3ClientProvider],
  exports: [s3ClientProvider],
})
export class S3Module {}
