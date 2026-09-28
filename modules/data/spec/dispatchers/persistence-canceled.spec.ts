import { PersistenceCanceled } from '../../';

describe('PersistenceCanceled', () => {
  it('should be an Error with a name and a stack', () => {
    const canceled = new PersistenceCanceled('user quit');

    expect(canceled).toBeInstanceOf(PersistenceCanceled);
    expect(canceled).toBeInstanceOf(Error);
    expect(canceled.name).toBe('PersistenceCanceled');
    expect(canceled.message).toBe('user quit');
    expect(canceled.stack).toContain('PersistenceCanceled');
  });

  it('should default the message when none is given', () => {
    expect(new PersistenceCanceled().message).toBe('Canceled by user');
    expect(new PersistenceCanceled('').message).toBe('Canceled by user');
  });
});
