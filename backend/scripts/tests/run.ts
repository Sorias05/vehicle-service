import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { resolveTargetApps } from './apps';

const apps = resolveTargetApps(process.argv[2]);
const rootDir = process.cwd();
const jestBin = require.resolve('jest/bin/jest');

function collectSpecFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectSpecFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.spec.ts')) {
      files.push(fullPath);
    }
  }

  return files;
}

let exitCode = 0;

for (const appName of apps) {
  const testDir = path.join(rootDir, 'apps', appName, 'test');
  const specFiles = collectSpecFiles(testDir);

  if (specFiles.length === 0) {
    console.log(
      `[${appName}] No spec files found in ${path.relative(rootDir, testDir)}`,
    );
    continue;
  }

  console.log(`[${appName}] Running ${specFiles.length} spec file(s)...`);

  // Run Jest per app and continue through all remaining apps even if a suite fails
  const result = spawnSync(
    process.execPath,
    [
      jestBin,
      '--runTestsByPath',
      ...specFiles,
      '--maxWorkers=50%',
      '--globals',
      JSON.stringify({ 'ts-jest': { isolatedModules: true } }),
      '--passWithNoTests',
    ],
    {
      stdio: 'inherit',
      env: {
        ...process.env,
        NODE_ENV: 'test',
      },
    },
  );

  const code = result.status ?? 1;
  if (code !== 0) {
    exitCode = exitCode || code;
  }
}

process.exit(exitCode);
