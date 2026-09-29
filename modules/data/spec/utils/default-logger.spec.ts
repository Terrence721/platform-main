import { MockInstance } from 'vitest';
import { DefaultLogger } from '../..';

describe('DefaultLogger', () => {
  const logger = new DefaultLogger();

  for (const method of ['error', 'log', 'warn'] as const) {
    describe(`#${method}`, () => {
      let consoleSpy: MockInstance;

      beforeEach(() => {
        consoleSpy = vi
          .spyOn(console, method)
          .mockImplementation(() => undefined);
      });

      afterEach(() => consoleSpy.mockRestore());

      it('writes the message alone when there is no extra value', () => {
        logger[method]('message');
        expect(consoleSpy).toHaveBeenCalledWith('message');
      });

      it('writes the message and the extra value', () => {
        const extra = { detail: 1 };
        logger[method]('message', extra);
        expect(consoleSpy).toHaveBeenCalledWith('message', extra);
      });

      it('writes falsy messages and extra values', () => {
        logger[method]('count', 0);
        logger[method](0);
        logger[method]('', false);
        expect(consoleSpy.mock.calls).toEqual([['count', 0], [0], ['', false]]);
      });

      it('writes nothing without a message', () => {
        logger[method]();
        logger[method](null);
        expect(consoleSpy).not.toHaveBeenCalled();
      });
    });
  }
});
