import { Tree } from '@angular-devkit/schematics';

// `type`/`pkg` become object keys below (json[type][pkg] = version). Without
// this guard, a value of "__proto__" reassigns the object's prototype
// instead of adding a normal property (CodeQL js/prototype-polluting-assignment).
// Direct string-literal comparisons, not a Set/array membership check -
// CodeQL's sanitizer recognition for this query doesn't trace booleans
// returned from Set.has()/Array.includes() back to the key being guarded.
function isUnsafeObjectKey(key: string): boolean {
  return key === '__proto__' || key === 'constructor' || key === 'prototype';
}

/**
 * Adds a package to the package.json
 */
export function addPackageToPackageJson(
  host: Tree,
  type: string,
  pkg: string,
  version: string
): Tree {
  if (isUnsafeObjectKey(type) || isUnsafeObjectKey(pkg)) {
    throw new Error(
      `Refusing to write unsafe package.json key: ${
        isUnsafeObjectKey(type) ? type : pkg
      }`
    );
  }

  if (host.exists('package.json')) {
    const sourceText = host.read('package.json')?.toString('utf-8') ?? '{}';
    const json = JSON.parse(sourceText);
    if (!json[type]) {
      // Null-prototype: even if an unsafe key ever reached this point, there
      // is no `__proto__` setter here to hijack. Belt-and-suspenders on top
      // of the isUnsafeObjectKey() guard above, not a replacement for it.
      json[type] = Object.create(null);
    }

    if (!json[type][pkg]) {
      json[type][pkg] = version;
    }

    host.overwrite('package.json', JSON.stringify(json, null, 2));
  }

  return host;
}
