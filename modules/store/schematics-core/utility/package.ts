import { Tree } from '@angular-devkit/schematics';

// `type`/`pkg` become object keys below (json[type][pkg] = version). Without
// this guard, a value of "__proto__" reassigns the object's prototype
// instead of adding a normal property (CodeQL js/prototype-polluting-assignment).
const UNSAFE_OBJECT_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Adds a package to the package.json
 */
export function addPackageToPackageJson(
  host: Tree,
  type: string,
  pkg: string,
  version: string
): Tree {
  if (UNSAFE_OBJECT_KEYS.has(type) || UNSAFE_OBJECT_KEYS.has(pkg)) {
    throw new Error(
      `Refusing to write unsafe package.json key: ${
        UNSAFE_OBJECT_KEYS.has(type) ? type : pkg
      }`
    );
  }

  if (host.exists('package.json')) {
    const sourceText = host.read('package.json')?.toString('utf-8') ?? '{}';
    const json = JSON.parse(sourceText);
    if (!json[type]) {
      json[type] = {};
    }

    if (!json[type][pkg]) {
      json[type][pkg] = version;
    }

    host.overwrite('package.json', JSON.stringify(json, null, 2));
  }

  return host;
}
