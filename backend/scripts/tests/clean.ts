import * as fs from 'node:fs';
import * as path from 'node:path';
import { resolveTargetApps } from './apps';

const apps = resolveTargetApps(process.argv[2]);
const rootDir = process.cwd();

for (const appName of apps) {
  const testDir = path.join(rootDir, 'apps', appName, 'test');

  if (fs.existsSync(testDir)) {
    // Remove temporary generated tests directory for the app
    fs.rmSync(testDir, { recursive: true, force: true });
    console.log(`[${appName}] Cleaned ${path.relative(rootDir, testDir)}`);
  } else {
    console.log(`[${appName}] Nothing to clean (${path.relative(rootDir, testDir)} does not exist)`);
  }
}