import { TestBed } from '@angular/core/testing';
import { StoreModule } from '@ngrx/store';
import { Observable } from 'rxjs';
import {
  EntityCollectionService,
  EntityCollectionServiceBase,
  EntityCollectionServiceFactory,
  EntityDataModuleWithoutEffects,
  EntitySelectors$,
} from '../..';

interface Hero {
  id: number;
  name: string;
}

interface HeroSelectors$ extends EntitySelectors$<Hero> {
  foo$: Observable<string>;
}

describe('EntityCollectionServiceFactory', () => {
  let factory: EntityCollectionServiceFactory;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [
        StoreModule.forRoot({}),
        EntityDataModuleWithoutEffects.forRoot({
          entityMetadata: {
            Hero: { additionalCollectionState: { foo: 'Foo' } },
          },
        }),
      ],
    });
    factory = TestBed.inject(EntityCollectionServiceFactory);
  });

  it('creates an EntityCollectionServiceBase for the entity type', () => {
    const service: EntityCollectionService<Hero> = factory.create<Hero>('Hero');
    expect(service).toBeInstanceOf(EntityCollectionServiceBase);
    expect(service.entityName).toBe('Hero');
  });

  it('keeps the custom selectors$ type', () => {
    const service = factory.create<Hero, HeroSelectors$>('Hero');
    expectTypeOf(service.selectors$.foo$).toEqualTypeOf<Observable<string>>();

    let foo: string | undefined;
    service.selectors$.foo$.subscribe((value) => (foo = value));
    expect(foo).toBe('Foo');
  });

  it('throws for an entity type with no definition', () => {
    expect(() => factory.create('Nobody')).toThrowError(
      'No EntityDefinition for entity type "Nobody".'
    );
  });
});
