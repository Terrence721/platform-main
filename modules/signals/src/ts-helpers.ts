type NonRecord =
  | Iterable<any>
  | WeakSet<any>
  | WeakMap<any, any>
  | Promise<any>
  | Date
  | Error
  | RegExp
  | ArrayBuffer
  | DataView
  | Function;

export type Prettify<T> = { [K in keyof T]: T[K] } & {};

export type IsRecord<T> = T extends object
  ? T extends NonRecord
    ? false
    : true
  : false;

// A key that is a pattern (a template literal such as `id-${string}`) is an
// index signature just like a plain `string` key. An empty object is only
// assignable to `Record<K, unknown>` when K is such a pattern, because a
// literal key would be required.
type IsPatternKey<K> = K extends PropertyKey
  ? Record<never, never> extends Record<K, unknown>
    ? true
    : false
  : false;

export type IsUnknownRecord<T> = keyof T extends never
  ? true
  : string extends keyof T
    ? true
    : symbol extends keyof T
      ? true
      : number extends keyof T
        ? true
        : true extends IsPatternKey<keyof T>
          ? true
          : false;

export type IsKnownRecord<T> =
  IsRecord<T> extends true
    ? IsUnknownRecord<T> extends true
      ? false
      : true
    : false;

export type HasKnownRecordMember<T> = true extends (
  T extends unknown ? IsKnownRecord<T> : never
)
  ? true
  : false;

export type NonRecordMembers<T> = T extends unknown
  ? IsKnownRecord<T> extends true
    ? never
    : T
  : never;

export type OmitPrivate<T> = {
  [K in keyof T as K extends `_${string}` ? never : K]: T[K];
};
