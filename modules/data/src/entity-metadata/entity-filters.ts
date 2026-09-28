/**
 * Filters the `entities` array argument and returns the original `entities`,
 * or a new filtered array of entities.
 * NEVER mutate the original `entities` array itself.
 **/
export type EntityFilterFn<T> = (entities: T[], pattern?: any) => T[];

/**
 * Creates an {EntityFilterFn} that matches RegExp or RegExp string pattern
 * anywhere in any of the given props of an entity.
 * If pattern is a string, spaces are significant and ignores case; a string
 * that is not a valid RegExp (e.g. `a(` typed into a search box) is matched
 * literally. A missing (null or undefined) prop never matches.
 */
export function PropsFilterFnFactory<T = any>(
  props: (keyof T)[] = []
): EntityFilterFn<T> {
  if (props.length === 0) {
    // No properties -> nothing could match -> return unfiltered
    return (entities: T[]) => entities;
  }

  return (entities: T[], pattern: string | RegExp) => {
    if (!entities) {
      return [];
    }

    const regExp = toRegExp(pattern);
    if (regExp) {
      const predicate = (e: any) =>
        props.some((prop) => e[prop] != null && testFromStart(regExp, e[prop]));
      return entities.filter(predicate);
    }
    return entities;
  };
}

function toRegExp(pattern: string | RegExp): RegExp | undefined {
  if (typeof pattern === 'string') {
    try {
      return new RegExp(pattern, 'i');
    } catch {
      return new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    }
  }
  // A copy, so the caller's RegExp (and its lastIndex) is left untouched.
  return pattern && new RegExp(pattern.source, pattern.flags);
}

/**
 * RegExp.test that starts each test at the beginning: with the stateful g/y
 * flags, test() would otherwise carry lastIndex from one entity to the next.
 */
function testFromStart(regExp: RegExp, value: unknown): boolean {
  regExp.lastIndex = 0;
  return regExp.test(String(value));
}
