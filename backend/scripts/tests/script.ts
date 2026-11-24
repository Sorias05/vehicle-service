import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import { resolveTargetApps } from './apps';

const apps = resolveTargetApps(process.argv[2]);
const tsNodeBin = require.resolve('ts-node/dist/bin.js');

function runScript(scriptFile: string, appName: string): number {
  const scriptPath = path.join(__dirname, scriptFile);
  const res = spawnSync(process.execPath, [tsNodeBin, scriptPath, appName], {
    stdio: 'inherit',
  });
  return res.status ?? 1;
}

let exitCode = 0;

for (const appName of apps) {
  try {
    // 1. Generate temporary unit test specs
    const genCode = runScript('generate.ts', appName);
    if (genCode !== 0) {
      exitCode = exitCode || genCode;
      continue;
    }

    // 2. Run unit tests for the current app without aborting the remaining apps on failure
    const runCode = runScript('run.ts', appName);
    if (runCode !== 0) {
      exitCode = exitCode || runCode;
    }
  } finally {
    // 3. Always clean up generated specs before moving to the next app
    const cleanCode = runScript('clean.ts', appName);
    if (cleanCode !== 0 && exitCode === 0) {
      exitCode = cleanCode;
    }
  }
}

process.exit(exitCode);