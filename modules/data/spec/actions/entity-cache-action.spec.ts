import { ChangeSet, SaveEntities, SaveEntitiesSuccess } from '../../';

describe.each([
  ['SaveEntities', SaveEntities],
  ['SaveEntitiesSuccess', SaveEntitiesSuccess],
])('%s', (_, ActionClass) => {
  it('should put the tag from the options on the payload and its change set', () => {
    const changeSet: ChangeSet = { changes: [] };
    const { payload } = new ActionClass(changeSet, 'url', { tag: 'A' });

    expect(payload.tag).toBe('A');
    expect(payload.changeSet.tag).toBe('A');
  });

  it("should prefer the change set's own tag", () => {
    const changeSet: ChangeSet = { changes: [], tag: 'Own' };
    const { payload } = new ActionClass(changeSet, 'url', { tag: 'A' });

    expect(payload.tag).toBe('Own');
    expect(payload.changeSet).toBe(changeSet);
  });

  it("should not write the tag onto the caller's change set", () => {
    const changeSet: ChangeSet = { changes: [] };
    new ActionClass(changeSet, 'url', { tag: 'A' });

    expect(changeSet.tag).toBeUndefined();
  });

  it('should use the new tag when a change set is saved again', () => {
    const changeSet: ChangeSet = { changes: [] };
    new ActionClass(changeSet, 'url', { tag: 'A' });
    const { payload } = new ActionClass(changeSet, 'url', { tag: 'B' });

    expect(payload.tag).toBe('B');
    expect(payload.changeSet.tag).toBe('B');
  });

  it('should accept a frozen change set', () => {
    const changeSet: ChangeSet = Object.freeze({ changes: [] });
    const { payload } = new ActionClass(changeSet, 'url', { tag: 'A' });

    expect(payload.changeSet).toEqual({ changes: [], tag: 'A' });
  });

  it('should not throw without a change set', () => {
    const { payload } = new ActionClass(undefined as any, 'url', { tag: 'A' });

    expect(payload.changeSet).toBeUndefined();
    expect(payload.tag).toBe('A');
  });
});
