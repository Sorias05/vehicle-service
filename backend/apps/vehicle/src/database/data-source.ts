import * as path from 'path';

import { createDataSource } from '@app/database/create-data-source';

export const AppDataSource = createDataSource({
  entitiesPath: path.resolve(__dirname, '../entities/*.entity.{ts,js}'),
  migrationsPath: path.resolve(__dirname, './migrations/*.{ts,js}'),
});
