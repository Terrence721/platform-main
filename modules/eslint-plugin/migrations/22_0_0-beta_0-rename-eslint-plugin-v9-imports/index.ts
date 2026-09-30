import { join } from '@angular-devkit/core';
import type {
  DirEntry,
  Rule,
  SchematicContext,
  Tree,
} from '@angular-devkit/schematics';

const OLD_IMPORT = '@ngrx/eslint-plugin/v9';
const NEW_IMPORT = '@ngrx/eslint-plugin';
const SUPPORTED_EXTENSIONS = [
  '.ts',
  '.tsx',
  '.mts',
  '.cts',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
];

export default function renameEslintPluginV9Imports(): Rule {
  return (tree: Tree, context: SchematicContext) => {
    for (const filePath of sourceFiles(tree.root)) {
      const content = tree.read(filePath)?.toString('utf-8');
      if (!content?.includes(OLD_IMPORT)) {
        continue;
      }

      tree.overwrite(filePath, content.replaceAll(OLD_IMPORT, NEW_IMPORT));
      context.logger.info(
        `[@ngrx/eslint-plugin] Renamed '${OLD_IMPORT}' to '${NEW_IMPORT}' in ${formatPath(filePath)}`
      );
    }
  };
}

// Walks the workspace without entering node_modules: `tree.visit` would list
// every installed package's files before any of them could be skipped.
function* sourceFiles(directory: DirEntry): Generator<string> {
  for (const file of directory.subfiles) {
    if (shouldMigrate(file)) {
      yield join(directory.path, file);
    }
  }

  for (const subdir of directory.subdirs) {
    if (subdir !== 'node_modules') {
      yield* sourceFiles(directory.dir(subdir));
    }
  }
}

function shouldMigrate(filePath: string): boolean {
  return SUPPORTED_EXTENSIONS.some((extension) => filePath.endsWith(extension));
}

function formatPath(filePath: string): string {
  return filePath.startsWith('/') ? filePath : `/${filePath}`;
}
