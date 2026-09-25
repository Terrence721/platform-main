import { minVersion, satisfies, validRange } from 'semver';

const dependencyFields = [
  'dependencies',
  'peerDependencies',
  'optionalDependencies',
  'devDependencies',
] as const;

type Dependencies = Record<string, string>;

export type Manifest = Partial<
  Record<(typeof dependencyFields)[number], Dependencies>
>;

export interface ModuleManifest {
  module: string;
  manifest: Manifest;
}

/**
 * A range that is allowed to differ from the other modules', pinned to its
 * exact current value.
 */
export interface Deviation {
  module: string;
  name: string;
  range: string;
}

interface Declaration {
  module: string;
  name: string;
  range: string;
}

/** Ranges that mean the same thing compare equal, whatever their spelling. */
function canonical(range: string): string {
  return validRange(range) ?? range;
}

function declarationsOf({ module, manifest }: ModuleManifest): Declaration[] {
  return dependencyFields.flatMap((field) =>
    Object.entries(manifest[field] ?? {}).map(([name, range]) => ({
      module,
      name,
      range,
    }))
  );
}

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    groups.set(key(item), [...(groups.get(key(item)) ?? []), item]);
  }
  return groups;
}

function agreementProblems(
  declarations: Declaration[],
  deviations: Deviation[]
): string[] {
  const problems: string[] = [];
  const isDeviation = (declaration: Declaration) =>
    deviations.some(
      ({ module, name }) =>
        module === declaration.module && name === declaration.name
    );
  const byName = groupBy(
    declarations.filter((declaration) => !isDeviation(declaration)),
    ({ name }) => name
  );

  for (const [name, sharing] of byName) {
    const byRange = groupBy(sharing, ({ range }) => canonical(range));
    if (byRange.size > 1) {
      const lines = [...byRange.values()].map(
        (group) =>
          `    ${group[0].range}  (${group.map((d) => d.module).join(', ')})`
      );
      problems.push(
        `${name}: modules declare different ranges\n${lines.join('\n')}`
      );
    }
  }

  for (const deviation of deviations) {
    const { module, name, range } = deviation;
    const declared = declarations.find(
      (declaration) =>
        declaration.module === module && declaration.name === name
    );
    if (!declared) {
      problems.push(
        `${name}: the exception for ${module} is stale, the module no longer declares it. Remove the exception.`
      );
    } else if (canonical(declared.range) !== canonical(range)) {
      problems.push(
        `${name}: the exception pins ${module} to ${range}, but it declares ${declared.range}. Update the exception, or align the module.`
      );
    } else {
      const others = new Set(
        (byName.get(name) ?? []).map((other) => canonical(other.range))
      );
      if (others.size === 1 && others.has(canonical(range))) {
        problems.push(
          `${name}: the exception for ${module} is stale, its range now matches the other modules. Remove the exception.`
        );
      }
    }
  }

  return problems;
}

function developmentVersionProblems(
  root: Manifest,
  declarations: Declaration[]
): string[] {
  const rootRanges = { ...root.dependencies, ...root.devDependencies };
  const problems: string[] = [];

  for (const { module, name, range } of declarations) {
    const rootRange = rootRanges[name];
    if (
      rootRange === undefined ||
      !validRange(rootRange) ||
      !validRange(range)
    ) {
      continue;
    }
    const developedWith = minVersion(rootRange);
    if (developedWith && !satisfies(developedWith, range)) {
      problems.push(
        `${module}: ${name} ${range} does not include ${developedWith.version}, the version the repo develops against (the root declares ${rootRange})`
      );
    }
  }

  return problems;
}

/**
 * Checks the dependency ranges declared by the module manifests:
 * 1. a package declared by several modules uses the same range in all of them
 *    (except for the pinned deviations, which must not go stale), and
 * 2. where the root manifest also declares the package, the version the repo
 *    develops against falls inside every module's range.
 */
export function findRangeProblems(
  root: Manifest,
  modules: ModuleManifest[],
  deviations: Deviation[] = []
): string[] {
  const declarations = modules.flatMap(declarationsOf);
  return [
    ...agreementProblems(declarations, deviations),
    ...developmentVersionProblems(root, declarations),
  ];
}
