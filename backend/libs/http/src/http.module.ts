import { HttpModule, HttpService } from '@nestjs/axios';
import { DynamicModule, Module } from '@nestjs/common';

import { HttpClientService } from './http.service';
import { HttpClientModuleOptions } from './http.types';

@Module({})
export class HttpClientModule {
  static register(options: HttpClientModuleOptions): DynamicModule {
    return {
      module: HttpClientModule,
      imports: [
        HttpModule.register({
          ...(options.baseURL ? { baseURL: options.baseURL } : {}),
          timeout: 0,
        }),
      ],
      providers: [
        {
          provide: HttpClientService,
          useFactory: (httpService: HttpService) =>
            new HttpClientService(httpService, options),
          inject: [HttpService],
        },
      ],
      exports: [HttpClientService],
    };
  }
}
