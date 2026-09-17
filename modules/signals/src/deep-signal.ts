import { computed, Signal, untracked } from '@angular/core';
import {
  HasKnownRecordMember,
  IsKnownRecord,
  NonRecordMembers,
} from './ts-helpers';

const deepSignalCache = new WeakMap<object, Map<PropertyKey, Signal<any>>>();

function getDeepSignalCache(target: object): Map<PropertyKey, Signal<any>> {
  let cache = deepSignalCache.get(target);
  if (!cache) {
    cache = new Map();
    deepSignalCache.set(target, cache);
  }

  return cache;
}

export type DeepSignal<T> = Signal<T> &
  (IsKnownRecord<T> extends true
    ? { readonly [K in keyof T]: DeepSignalOf<T[K]> }
    : unknown);

export type DeepSignalOf<T> =
  HasKnownRecordMember<T> extends true
    ? DeepSignalRecordMembers<T> | DeepSignalNonRecordMembers<T>
    : Signal<T>;

type DeepSignalRecordMembers<T> = T extends unknown
  ? IsKnownRecord<T> extends true
    ? DeepSignal<T>
    : never
  : never;

type DeepSignalNonRecordMembers<T> = [NonRecordMembers<T>] extends [never]
  ? never
  : Signal<NonRecordMembers<T>>;

export function toDeepSignal<T>(signal: Signal<T>): DeepSignalOf<T> {
  return new Proxy(signal, {
    has(target: any, prop) {
      return !!this.get?.(target, prop, undefined);
    },
    get(target: any, prop) {
      const value = untracked(target);
      const cache = getDeepSignalCache(target);

      if (!isRecord(value) || !(prop in value)) {
        // The underlying value no longer has this property (e.g. a
        // discriminated union that changed shape) - drop any stale cached
        // computed signal for it and fall through to whatever real property
        // lives on the signal itself (e.g. `set`/`update`/`asReadonly`).
        // Deliberately cached in a side WeakMap instead of being written
        // directly onto `target` (the real, possibly writable, underlying
        // signal): a state property that happens to be named `set`/`update`/
        // etc. would otherwise silently overwrite the signal's own mutation
        // methods, breaking `patchState` with no error - confirmed with a
        // real repro against signalState/patchState.
        cache.delete(prop);

        return target[prop];
      }

      let propSignal = cache.get(prop);
      if (!propSignal) {
        propSignal = computed(() => target()[prop]);
        cache.set(prop, propSignal);
      }

      return toDeepSignal(propSignal);
    },
  });
}

const nonRecords = [
  WeakSet,
  WeakMap,
  Promise,
  Date,
  Error,
  RegExp,
  ArrayBuffer,
  DataView,
  Function,
];

function isRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || isIterable(value)) {
    return false;
  }

  let proto = Object.getPrototypeOf(value);
  if (proto === Object.prototype) {
    return true;
  }

  while (proto && proto !== Object.prototype) {
    if (nonRecords.includes(proto.constructor)) {
      return false;
    }
    proto = Object.getPrototypeOf(proto);
  }

  return proto === Object.prototype;
}

function isIterable(value: any): value is Iterable<any> {
  return typeof value?.[Symbol.iterator] === 'function';
}
