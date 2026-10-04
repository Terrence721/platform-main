import {
  isTicketMessageKind,
  TICKET_MESSAGE_KINDS,
  TicketMessageKind,
} from './ticket-message';

describe('ticket message kinds', () => {
  it('lists a reply and an internal note', () => {
    expect(TICKET_MESSAGE_KINDS).toEqual(['reply', 'note']);
  });

  it('derives the type from the list', () => {
    expectTypeOf<TicketMessageKind>().toEqualTypeOf<'reply' | 'note'>();
  });
});

describe('isTicketMessageKind', () => {
  it.each(TICKET_MESSAGE_KINDS)('accepts the kind %s', (kind) => {
    expect(isTicketMessageKind(kind)).toBe(true);
  });

  it.each(['Reply', 'email', ''])('rejects the string "%s"', (value) => {
    expect(isTicketMessageKind(value)).toBe(false);
  });

  it.each([undefined, null, 1])(
    'rejects %s, which is not a string',
    (value) => {
      expect(isTicketMessageKind(value)).toBe(false);
    }
  );
});
