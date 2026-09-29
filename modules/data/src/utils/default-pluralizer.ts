import { Inject, Injectable, Optional } from '@angular/core';
import { EntityPluralNames, PLURAL_NAMES_TOKEN } from './interfaces';

const uncountable = [
  // 'sheep',
  // 'fish',
  // 'deer',
  // 'moose',
  // 'rice',
  // 'species',
  'equipment',
  'information',
  'money',
  'series',
];

@Injectable()
export class DefaultPluralizer {
  pluralNames: EntityPluralNames = {};

  constructor(
    @Optional()
    @Inject(PLURAL_NAMES_TOKEN)
    pluralNames: EntityPluralNames[] | EntityPluralNames | null
  ) {
    // merge each plural names object; a multi provider gives an array, one
    // provided without `multi` gives a single map, which is accepted too
    const maps = Array.isArray(pluralNames)
      ? pluralNames
      : pluralNames
        ? [pluralNames]
        : [];
    maps.forEach((pn) => this.registerPluralNames(pn));
  }

  /**
   * Pluralize a singular name using common English language pluralization rules
   * Examples: "company" -> "companies", "employee" -> "employees", "tax" -> "taxes"
   * Irregular plurals (e.g. "hero" -> "heroes", "quiz" -> "quizzes") are not
   * derived: register them as plural names.
   */
  pluralize(name: string) {
    // Own properties only: a name like "constructor" would otherwise find
    // the inherited Object.prototype member.
    const plural = Object.prototype.hasOwnProperty.call(this.pluralNames, name)
      ? this.pluralNames[name]
      : undefined;
    if (plural) {
      return plural;
    }
    // singular and plural are the same
    if (uncountable.indexOf(name.toLowerCase()) >= 0) {
      return name;
      // vowel + y
    } else if (/[aeiou]y$/.test(name)) {
      return name + 's';
      // consonant + y
    } else if (name.endsWith('y')) {
      return name.substring(0, name.length - 1) + 'ies';
      // endings typically pluralized with 'es'
    } else if (/(?:s|sh|ch|x|z)$/.test(name)) {
      return name + 'es';
    } else {
      return name + 's';
    }
  }

  /**
   * Register a mapping of entity type name to the entity name's plural
   * @param pluralNames {EntityPluralNames} plural names for entity types
   */
  registerPluralNames(pluralNames: EntityPluralNames): void {
    this.pluralNames = { ...this.pluralNames, ...(pluralNames || {}) };
  }
}
