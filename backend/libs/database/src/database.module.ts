import { DynamicModule, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { entities } from './entities';

@Module({})
export class DatabaseModule {
  static registerDatabase(serviceEntities: any[]): DynamicModule {
    const database = [
      TypeOrmModule.forRoot({
        type: 'postgres',
        url: process.env.POSTGRES_URI,
        entities: entities,
        synchronize: false,
        autoLoadEntities: false,
      }),
      TypeOrmModule.forFeature(serviceEntities),
    ];

    return {
      module: DatabaseModule,
      imports: database,
      exports: database,
    };
  }
}
