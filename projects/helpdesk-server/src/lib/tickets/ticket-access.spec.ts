import { NOT_YOURS, UUID } from './ticket-access';

describe('ticket-access constants', () => {
  it('matches valid UUIDs', () => {
    expect(UUID.test('123e4567-e89b-12d3-a456-426614174000')).toBe(true);
    expect(UUID.test('123E4567-E89B-12D3-A456-426614174000')).toBe(true);
  });

  it('rejects non-UUID ids', () => {
    expect(UUID.test('not-a-uuid')).toBe(false);
    expect(UUID.test('123')).toBe(false);
    expect(UUID.test('')).toBe(false);
  });

  it('keeps the shared not-yours message', () => {
    expect(NOT_YOURS).toBe('No such ticket among yours.');
  });
});
