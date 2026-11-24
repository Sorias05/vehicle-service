import * as fs from 'node:fs';
import * as path from 'node:path';
import { Project, ClassDeclaration, FunctionDeclaration } from 'ts-morph';
import { resolveTargetApps } from './apps';

const apps = resolveTargetApps(process.argv[2]);
const rootDir = process.cwd();

const project = new Project({
  tsConfigFilePath: path.join(rootDir, 'tsconfig.json'),
  skipAddingFilesFromTsConfig: true,
});

// Always use POSIX forward slashes so TS import paths work cleanly on Windows
function toImportPath(fromDir: string, targetFileWithoutExt: string): string {
  const rel = path.relative(fromDir, targetFileWithoutExt).replace(/\\/g, '/');
  return rel.startsWith('.') ? rel : `./${rel}`;
}

function collectSourceFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // Skip database migration directories
      if (entry.name === 'migrations') {
        continue;
      }
      files.push(...collectSourceFiles(fullPath));
    } else if (
      entry.isFile() &&
      entry.name.endsWith('.ts') &&
      !entry.name.endsWith('.spec.ts') &&
      !entry.name.endsWith('.e2e-spec.ts') &&
      !entry.name.endsWith('.module.ts') &&
      !entry.name.endsWith('.entity.ts') &&
      !entry.name.endsWith('.dto.ts') &&
      entry.name !== 'main.ts'
    ) {
      files.push(fullPath);
    }
  }

  return files;
}

function buildClassSpec(
  classDecl: ClassDeclaration,
  targetImportPath: string,
): string {
  const className = classDecl.getName() ?? 'TargetClass';
  const ctorParams = classDecl.getConstructors()[0]?.getParameters() ?? [];
  const mockArgs = ctorParams.map(() => 'createMock()').join(', ');

  const methods = classDecl
    .getMethods()
    .filter((m) => m.getScope() !== 'private')
    .map((m) => m.getName());

  const methodSpecs = methods
    .map(
      (methodName) => `  describe('${methodName}', () => {
    it('should be callable', async () => {
      // TODO: arrange inputs, mock behavior, and assert result
      expect(target).toBeDefined();
    });
  });`,
    )
    .join('\n\n');

  return `import { ${className} } from '${targetImportPath}';

// Safe mock factory without thenable traps for async/await
const createMock = <T = any>(): T =>
  new Proxy({} as Record<PropertyKey, unknown>, {
    get(mockTarget, prop) {
      if (prop === 'then' || typeof prop === 'symbol') {
        return undefined;
      }
      if (!(prop in mockTarget)) {
        mockTarget[prop as string] = jest.fn();
      }
      return mockTarget[prop as string];
    },
  }) as T;

describe('${className}', () => {
  let target: ${className};

  beforeEach(() => {
    // Instantiate class directly with mocks for fast isolated unit testing
    target = new ${className}(${mockArgs});
  });

  it('should be defined', () => {
    expect(target).toBeDefined();
  });

${methodSpecs}
});
`;
}

function buildFunctionsSpec(
  fns: FunctionDeclaration[],
  targetImportPath: string,
): string {
  const exportedFns = fns.filter((f) => f.isExported() && f.getName());
  if (exportedFns.length === 0) return '';

  const fnNames = exportedFns.map((f) => f.getName()!);
  const blocks = fnNames
    .map(
      (fnName) => `  describe('${fnName}', () => {
    it('should execute ${fnName}', () => {
      // TODO: provide arguments and assert output
      expect(${fnName}).toBeDefined();
    });
  });`,
    )
    .join('\n\n');

  return `import { ${fnNames.join(', ')} } from '${targetImportPath}';

describe('Exported functions', () => {
${blocks}
});
`;
}

for (const appName of apps) {
  const srcDir = path.join(rootDir, 'apps', appName, 'src');
  const testDir = path.join(rootDir, 'apps', appName, 'test');

  fs.mkdirSync(testDir, { recursive: true });

  const sourceFiles = collectSourceFiles(srcDir);
  let generatedCount = 0;

  for (const filePath of sourceFiles) {
    const sourceFile = project.addSourceFileAtPath(filePath);
    const classes = sourceFile.getClasses();
    const functions = sourceFile.getFunctions().filter((f) => f.isExported());

    if (classes.length === 0 && functions.length === 0) {
      continue;
    }

    const relFromSrc = path.relative(srcDir, filePath);
    const specPath = path.join(
      testDir,
      relFromSrc.replace(/\.ts$/, '.spec.ts'),
    );
    const specDir = path.dirname(specPath);
    fs.mkdirSync(specDir, { recursive: true });

    const targetImportPath = toImportPath(
      specDir,
      filePath.replace(/\.ts$/, ''),
    );
    const sections: string[] = [];

    for (const cls of classes) {
      sections.push(buildClassSpec(cls, targetImportPath));
    }

    if (functions.length > 0) {
      const fnSpec = buildFunctionsSpec(functions, targetImportPath);
      if (fnSpec) sections.push(fnSpec);
    }

    fs.writeFileSync(specPath, sections.join('\n'), 'utf8');
    generatedCount++;
  }

  console.log(
    `[${appName}] Generated ${generatedCount} spec file(s) in ${path.relative(rootDir, testDir)}`,
  );
}
