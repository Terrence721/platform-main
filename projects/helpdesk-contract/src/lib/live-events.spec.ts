import { isLiveEvent, type LiveEvent } from './live-events';

describe('isLiveEvent', () => {
  it.each([
    [{ type: 'ticket', ticketId: 'ticket-1' }],
    [{ type: 'message', ticketId: 'ticket-1' }],
    [{ type: 'accounts' }],
    // New requests changed (#1026).
    [{ type: 'requests' }],
  ])('accepts %j', (value) => {
    expect(isLiveEvent(value)).toBe(true);
  });

  it.each([
    [null],
    [undefined],
    ['ticket'],
    [1],
    [[]],
    [{}],
    [{ type: 'party', ticketId: 'ticket-1' }],
    [{ type: 'ticket' }],
    [{ type: 'message' }],
    [{ type: 'ticket', ticketId: 1 }],
    [{ type: 'message', ticketId: null }],
  ])('rejects %j', (value) => {
    expect(isLiveEvent(value)).toBe(false);
  });

  it('narrows the type', () => {
    const value: unknown = { type: 'accounts' };
    if (isLiveEvent(value)) {
      expectTypeOf(value).toEqualTypeOf<LiveEvent>();
    }
  });
});
