import { createStateOperator, DidMutate } from '../src/state_adapter';

describe('createStateOperator', () => {
  it('returns a new state with both ids and entities when the mutator reports Both', () => {
    const operation = (createStateOperator as any)(
      (value: number, state: any) => {
        state.ids.push(value);
        state.entities[value] = { id: value };
        return DidMutate.Both;
      }
    );

    const state = { ids: [1], entities: { 1: { id: 1 } } };
    const result = operation(2, state);

    expect(result).toEqual({
      ids: [1, 2],
      entities: { 1: { id: 1 }, 2: { id: 2 } },
    });
    expect(state).toEqual({ ids: [1], entities: { 1: { id: 1 } } });
  });

  it('returns only updated entities when the mutator reports EntitiesOnly', () => {
    const operation = (createStateOperator as any)(
      (value: number, state: any) => {
        state.entities[value] = { id: value };
        return DidMutate.EntitiesOnly;
      }
    );

    const result = operation(2, { ids: [1], entities: { 1: { id: 1 } } });

    expect(result).toEqual({
      ids: [1],
      entities: { 1: { id: 1 }, 2: { id: 2 } },
    });
  });

  it('returns the original state when the mutator reports None', () => {
    const operation = (createStateOperator as any)(() => DidMutate.None);
    const state = { ids: [1], entities: { 1: { id: 1 } } };

    const result = operation(2, state);

    expect(result).toBe(state);
  });
});
