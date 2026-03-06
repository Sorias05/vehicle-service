import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { entities } from './entities';
dotenv.config();

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.POSTGRES_URI,
  entities: entities,
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  synchronize: false,
});