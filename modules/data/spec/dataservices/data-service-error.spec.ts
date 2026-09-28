import { HttpErrorResponse } from '@angular/common/http';
import { DataServiceError } from '../../';

describe('DataServiceError', () => {
  describe('#message', () => {
    it('should define message when ctor error is string', () => {
      const expected = 'The error';
      const dse = new DataServiceError(expected, null);
      expect(dse.message).toBe(expected);
    });

    it('should define message when ctor error is new Error("message")', () => {
      const expected = 'The error';
      const dse = new DataServiceError(new Error(expected), null);
      expect(dse.message).toBe(expected);
    });

    it('should define message when ctor error is typical HttpResponseError', () => {
      const expected = 'The error';
      const body = expected; // server error is typically in the body of the server response
      const httpErr = new HttpErrorResponse({
        status: 400,
        statusText: 'Bad Request',
        url: 'http://foo.com/bad',
        error: body,
      });
      const dse = new DataServiceError(httpErr, null);
      expect(dse.message).toBe(expected);
    });

    it('should use the message of an error body that has one', () => {
      const httpErr = new HttpErrorResponse({
        status: 500,
        url: 'http://foo.com/bad',
        error: { message: 'The error' },
      });
      const dse = new DataServiceError(httpErr, null);
      expect(dse.message).toBe('The error');
    });

    it("should fall back to the response's message when the error body has none", () => {
      const httpErr = new HttpErrorResponse({
        status: 400,
        statusText: 'Bad Request',
        url: 'http://foo.com/bad',
        error: { title: 'Invalid', detail: 'name is required' },
      });
      const dse = new DataServiceError(httpErr, null);
      expect(dse.message).toBe(httpErr.message);
      expect(dse.message).not.toBe('');
    });

    it("should use the response's message for a network failure", () => {
      const httpErr = new HttpErrorResponse({
        status: 0,
        statusText: 'Unknown Error',
        url: 'http://foo.com/bad',
        error: new ProgressEvent('error'),
      });
      const dse = new DataServiceError(httpErr, null);
      expect(dse.message).toBe(httpErr.message);
    });

    it('should not throw when the error is missing', () => {
      expect(new DataServiceError(null, null).message).toBe('');
      expect(new DataServiceError(undefined, null).message).toBe('');
    });
  });
});
