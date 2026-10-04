import { HttpErrorResponse } from '@angular/common/http';
import { apiErrorMessage } from './api-error-message';

const FALLBACK = 'That did not work. Please try again.';

/** An error the API answered with `status`, and a body of `error`. */
const answered = (
  status: number,
  error: unknown = { message: 'From the API.' }
) => new HttpErrorResponse({ status, error });

describe('apiErrorMessage', () => {
  it.each([400, 403, 404, 409])(
    "passes on the API's own message for a %s",
    (status) => {
      expect(apiErrorMessage(answered(status), FALLBACK)).toBe('From the API.');
    }
  );

  it.each([
    ['a server error (500)', answered(500)],
    ['no answer at all (the API down)', answered(0)],
    ['a refusal without a message', answered(404, null)],
    ['a refusal whose message is not text', answered(409, { message: 7 })],
    ['an error that is not from HTTP', new Error('Something broke.')],
  ])('falls back for %s', (_, error) => {
    expect(apiErrorMessage(error, FALLBACK)).toBe(FALLBACK);
  });
});
