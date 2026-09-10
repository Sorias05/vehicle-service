import * as dotenv from 'dotenv';
import { DataSource } from 'typeorm';

import { entities } from './entities';

import 'reflect-metadata';
dotenv.config();

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.POSTGRES_URI,
  // url: process.env.POSTGRES_URI_LOCAL,
  entities: entities,
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  synchronize: false,
});
