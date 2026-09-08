import { pluralize } from './strings';

describe('string utilities', () => {
  describe('pluralize', () => {
    it('leaves a name unchanged and appends s when no rule matches', () => {
      expect(pluralize('user')).toBe('users');
    });

    it('replaces a consonant + y with ie before appending s', () => {
      expect(pluralize('category')).toBe('categories');
    });

    it('replaces a trailing f or fe with ve before appending s', () => {
      expect(pluralize('knife')).toBe('knives');
      expect(pluralize('leaf')).toBe('leaves');
    });

    it('inserts e before s for a consonant + o, s/x/z, or ch/sh ending', () => {
      expect(pluralize('potato')).toBe('potatoes');
      expect(pluralize('regex')).toBe('regexes');
      expect(pluralize('church')).toBe('churches');
    });

    it('does not treat a vowel + y as the consonant+y case', () => {
      expect(pluralize('day')).toBe('days');
    });

    it('lowercases the first character, matching the FeatureKey property-name convention its one real caller relies on', () => {
      expect(pluralize('Book')).toBe('books');
    });
  });
});
