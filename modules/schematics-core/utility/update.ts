import { Rule, Tree, SchematicsException } from '@angular-devkit/schematics';

export function updatePackage(name: string): Rule {
  return (tree: Tree) => {
    const pkgPath = '/package.json';
    const buffer = tree.read(pkgPath);
    if (buffer === null) {
      throw new SchematicsException('Could not read package.json');
    }
    const content = buffer.toString();
    const pkg = JSON.parse(content);

    if (pkg === null || typeof pkg !== 'object' || Array.isArray(pkg)) {
      throw new SchematicsException('Error reading package.json');
    }

    const dependencyCategories = ['dependencies', 'devDependencies'];
    let changed = false;

    dependencyCategories.forEach((category) => {
      const packageName = `@ngrx/${name}`;

      if (pkg[category] && pkg[category][packageName]) {
        const firstChar = pkg[category][packageName][0];
        const suffix = match(firstChar, '^') || match(firstChar, '~');
        const version = `${suffix}6.0.0`;

        if (pkg[category][packageName] !== version) {
          pkg[category][packageName] = version;
          changed = true;
        }
      }
    });

    // Left alone when nothing changed; otherwise written back with the
    // file's own indentation, line endings and final line break.
    if (changed) {
      const indent = /\n([ \t]+)"/.exec(content)?.[1] ?? 2;
      const lineBreak = content.includes('\r\n') ? '\r\n' : '\n';
      const finalLineBreak = /\n$/.test(content) ? lineBreak : '';
      tree.overwrite(
        pkgPath,
        JSON.stringify(pkg, null, indent).replace(/\n/g, lineBreak) +
          finalLineBreak
      );
    }

    return tree;
  };
}

function match(value: string, test: string) {
  return value === test ? test : '';
}
