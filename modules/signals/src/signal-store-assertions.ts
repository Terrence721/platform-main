import { InnerSignalStore } from './signal-store-models';

export function assertUniqueStoreMembers(
  store: InnerSignalStore,
  newMemberKeys: Array<string | symbol>
): void {
  const storeMembers = {
    ...store.stateSignals,
    ...store.props,
    ...store.methods,
  };
  const overriddenKeys = Reflect.ownKeys(storeMembers).filter((memberKey) =>
    newMemberKeys.includes(memberKey)
  );

  if (overriddenKeys.length > 0) {
    console.warn(
      '@ngrx/signals: SignalStore members cannot be overridden.',
      'Trying to override:',
      overriddenKeys.map((key) => String(key)).join(', ')
    );
  }
}

export function assertPlainObject(value: object, feature: string): void {
  const prototype = Object.getPrototypeOf(value);
  // An object literal, an object without a prototype, or a plain object of
  // another realm: nothing that the prototype chain could add to it.
  if (prototype === null || Object.getPrototypeOf(prototype) === null) {
    return;
  }

  console.warn(
    `@ngrx/signals: ${feature} expects a plain object, but received an instance of ${
      prototype.constructor?.name || 'an unnamed class'
    }.`,
    'Only its own enumerable properties are added to the SignalStore; members it inherits from its prototype are ignored.',
    'Return an object literal instead, e.g. { service: inject(Service) }.'
  );
}
