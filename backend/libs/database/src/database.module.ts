import { DynamicModule, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({})
export class DatabaseModule {
  static register(serviceEntities: any[] = []): DynamicModule {
    return {
      module: DatabaseModule,
      imports: [
        TypeOrmModule.forRootAsync({
          inject: [ConfigService],
          useFactory: (configService: ConfigService) => ({
            type: 'postgres',
            url: configService.getOrThrow<string>('POSTGRES_URI'),
            autoLoadEntities: true,
            synchronize: false,
            logging: configService.get('NODE_ENV') === 'development',
          }),
        }),
        TypeOrmModule.forFeature(serviceEntities),
      ],
      exports: [TypeOrmModule],
    };
  }
}
