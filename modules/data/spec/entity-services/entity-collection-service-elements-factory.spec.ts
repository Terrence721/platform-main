import { TestBed } from '@angular/core/testing';
import { StoreModule } from '@ngrx/store';
import {
  EntityCollectionServiceElementsFactory,
  EntityDataModuleWithoutEffects,
  EntityDispatcherBase,
} from '../..';

describe('EntityCollectionServiceElementsFactory', () => {
  let factory: EntityCollectionServiceElementsFactory;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [
        StoreModule.forRoot({}),
        EntityDataModuleWithoutEffects.forRoot({
          entityMetadata: {
            Hero: { entityDispatcherOptions: { optimisticAdd: true } },
            Villain: {},
          },
        }),
      ],
    });
    factory = TestBed.inject(EntityCollectionServiceElementsFactory);
  });

  /** The dispatcher's effective defaults (a private field). */
  function dispatcherOptions(entityName: string) {
    const { dispatcher } = factory.create(entityName);
    expect(dispatcher).toBeInstanceOf(EntityDispatcherBase);
    return (dispatcher as any).defaultDispatcherOptions;
  }

  it("applies the entity's own dispatcher options over the defaults", () => {
    expect(dispatcherOptions('Hero').optimisticAdd).toBe(true);
    expect(dispatcherOptions('Villain').optimisticAdd).toBe(false);
  });

  it('creates every element for the trimmed entity name', () => {
    const elements = factory.create(' Hero ');
    expect(elements.entityName).toBe('Hero');
    expect(elements.dispatcher.entityName).toBe('Hero');
    expect(elements.selectors$.entityName).toBe('Hero');
    expect(typeof elements.selectors.selectEntities).toBe('function');
  });

  it('throws for an entity type with no definition', () => {
    expect(() => factory.create('Nobody')).toThrowError(
      'No EntityDefinition for entity type "Nobody".'
    );
  });
});
