import { errorText } from './error-text';

describe('errorText', () => {
  it("gives an error's message", () => {
    expect(errorText(new Error('relation "users" does not exist'))).toBe(
      'relation "users" does not exist'
    );
  });

  // Drizzle wraps every database error: its message is only the query, and
  // the reason is the cause.
  it('adds each cause, so the reason behind a failed query is shown', () => {
    const refused = new Error('connect ECONNREFUSED 127.0.0.1:5435');
    const failed = new Error('Failed query: select 1\nparams: ', {
      cause: refused,
    });

    expect(errorText(failed)).toBe(
      'Failed query: select 1\nparams:  — connect ECONNREFUSED 127.0.0.1:5435'
    );
  });

  it('gives anything that is not an Error as text', () => {
    expect(errorText('timed out')).toBe('timed out');
    expect(errorText(new Error('outer', { cause: 'inner' }))).toBe(
      'outer — inner'
    );
  });

  it('stops at a cause that points back into the chain', () => {
    const error = new Error('looped');
    error.cause = error;

    expect(errorText(error)).toBe('looped');
  });
});
