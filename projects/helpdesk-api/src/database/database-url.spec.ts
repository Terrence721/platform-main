import { databaseUrl, DEFAULT_DATABASE_URL } from './database-url';

describe('databaseUrl', () => {
  it('uses DATABASE_URL when it is set', () => {
    const url = 'postgres://someone:secret@db.internal:5432/helpdesk';

    expect(databaseUrl({ DATABASE_URL: url })).toBe(url);
  });

  it('falls back to the local development database when it is missing', () => {
    expect(databaseUrl({})).toBe(DEFAULT_DATABASE_URL);
  });

  it('falls back when it is empty, as an unfilled line in .env leaves it', () => {
    expect(databaseUrl({ DATABASE_URL: '' })).toBe(DEFAULT_DATABASE_URL);
  });

  it('points by default at the database compose.yaml publishes', () => {
    expect(DEFAULT_DATABASE_URL).toBe(
      'postgres://helpdesk:helpdesk-dev-only@localhost:5435/helpdesk'
    );
  });
});
