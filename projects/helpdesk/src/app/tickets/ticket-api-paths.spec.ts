import {
  assigneeApi,
  messagesApi,
  statusApi,
  ticketApi,
} from './ticket-api-paths';

describe('ticket-api-paths', () => {
  it('builds one ticket URL with an escaped id', () => {
    expect(ticketApi('abc')).toBe('/api/tickets/abc');
    expect(ticketApi('a/b')).toBe('/api/tickets/a%2Fb');
  });

  it('builds the assignee, status and messages URLs', () => {
    const id = 'ticket-1';

    expect(assigneeApi(id)).toBe('/api/tickets/ticket-1/assignee');
    expect(statusApi(id)).toBe('/api/tickets/ticket-1/status');
    expect(messagesApi(id)).toBe('/api/tickets/ticket-1/messages');
  });

  it('encodes special characters in every path', () => {
    const id = 'a b?';

    expect(ticketApi(id)).toBe('/api/tickets/a%20b%3F');
    expect(messagesApi(id)).toBe('/api/tickets/a%20b%3F/messages');
  });
});
