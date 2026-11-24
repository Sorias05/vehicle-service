import * as fs from 'node:fs';
import * as path from 'node:path';

export function resolveTargetApps(appArg?: string): string[] {
  const appsDir = path.join(process.cwd(), 'apps');

  if (!fs.existsSync(appsDir)) {
    throw new Error(`Apps directory not found: ${appsDir}`);
  }

  // If a specific app name is provided, run only for that app
  if (appArg) {
    const appSrcDir = path.join(appsDir, appArg, 'src');
    if (!fs.existsSync(appSrcDir)) {
      throw new Error(
        `App "${appArg}" or its src directory not found: ${appSrcDir}`,
      );
    }
    return [appArg];
  }

  // Otherwise collect all apps that contain a src directory
  return fs
    .readdirSync(appsDir, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isDirectory() &&
        fs.existsSync(path.join(appsDir, entry.name, 'src')),
    )
    .map((entry) => entry.name)
    .sort();
}
