import { InjectionToken } from '@angular/core';

/**
 * Logs @ngrx/data errors, messages and warnings. The default is
 * DefaultLogger (the console); provide another to send them elsewhere.
 */
export abstract class Logger {
  abstract error(message?: any, ...optionalParams: any[]): void;
  abstract log(message?: any, ...optionalParams: any[]): void;
  abstract warn(message?: any, ...optionalParams: any[]): void;
}

/**
 * Mapping of entity type name to its plural
 */
export interface EntityPluralNames {
  [entityName: string]: string;
}

/**
 * Plural names for the default pluralizer, merged in provider order.
 * A multi token: provide each map with `multi: true` (as `pluralNames` in the
 * EntityData config does); injecting it gives the array of maps. A single
 * map provided without `multi` is accepted too.
 */
export const PLURAL_NAMES_TOKEN = new InjectionToken<EntityPluralNames[]>(
  '@ngrx/data Plural Names'
);

/**
 * Pluralizes entity type names for the HTTP resource URLs. The default is
 * DefaultPluralizer.
 */
export abstract class Pluralizer {
  abstract pluralize(name: string): string;
}
