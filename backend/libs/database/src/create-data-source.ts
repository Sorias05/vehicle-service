import * as dotenv from 'dotenv';
import * as path from 'path';
import { DataSource } from 'typeorm';

export function createDataSource(options: {
  entitiesPath: string;
  migrationsPath: string;
}): DataSource {
  dotenv.config({ path: path.resolve(process.cwd(), '.env') });

  const rawUri = process.env.POSTGRES_URI;
  if (!rawUri) {
    throw new Error('POSTGRES_URI is not defined in environment variables');
  }

  const dbUrl = new URL(rawUri);

  const isDocker = process.env.IS_DOCKER === 'true';
  if (!isDocker && dbUrl.hostname === 'postgres') {
    dbUrl.hostname = 'localhost';
  }

  return new DataSource({
    type: 'postgres',
    url: dbUrl.toString(),
    synchronize: false,
    entities: [options.entitiesPath],
    migrations: [options.migrationsPath],
  });
}
