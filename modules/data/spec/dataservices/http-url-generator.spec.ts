import {
  DefaultHttpUrlGenerator,
  normalizeRoot,
} from '../../src/dataservices/http-url-generator';
import { Pluralizer } from '../../src/utils/interfaces';

describe('DefaultHttpUrlGenerator', () => {
  const pluralizer: Pluralizer = { pluralize: (name) => `${name}s` };
  let generator: DefaultHttpUrlGenerator;

  beforeEach(() => {
    generator = new DefaultHttpUrlGenerator(pluralizer);
  });

  it('should build lowercase entity and collection URLs under the root', () => {
    expect(generator.entityResource('Hero', 'api', false)).toBe('api/hero/');
    expect(generator.collectionResource('Hero', 'api')).toBe('api/heros/');
  });

  it('should keep the case of the root, which is part of a case-sensitive path', () => {
    expect(generator.entityResource('Hero', 'api/V2', false)).toBe(
      'api/V2/hero/'
    );
    expect(generator.collectionResource('Hero', 'api/V2')).toBe(
      'api/V2/heros/'
    );
  });

  it('should trim slashes and whitespace from the root unless trailingSlashEndpoints', () => {
    expect(generator.entityResource('Hero', ' /api/ ', false)).toBe(
      'api/hero/'
    );
    const keeping = new DefaultHttpUrlGenerator(pluralizer);
    expect(keeping.entityResource('Hero', '/api/', true)).toBe('/api//hero/');
  });

  it('should return registered URLs as given', () => {
    generator.registerHttpResourceUrls({
      Hero: {
        entityResourceUrl: 'Custom/Hero/',
        collectionResourceUrl: 'Custom/Heroes/',
      },
    });
    expect(generator.entityResource('Hero', 'api', false)).toBe('Custom/Hero/');
    expect(generator.collectionResource('Hero', 'api')).toBe('Custom/Heroes/');
  });

  it('should build URLs for entity names that Object.prototype also has', () => {
    for (const name of ['constructor', 'toString']) {
      expect(generator.entityResource(name, 'api', false)).toBe(
        `api/${name.toLowerCase()}/`
      );
    }
  });

  it('should accept registering nothing', () => {
    generator.registerHttpResourceUrls(undefined as any);
    expect(generator.entityResource('Hero', 'api', false)).toBe('api/hero/');
  });
});

describe('normalizeRoot', () => {
  it('should remove leading and trailing slashes and whitespace', () => {
    expect(normalizeRoot('  //api/v1//  ')).toBe('api/v1');
    expect(normalizeRoot('https://example.com/api/')).toBe(
      'https://example.com/api'
    );
    expect(normalizeRoot('/')).toBe('');
  });
});
