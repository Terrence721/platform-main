import { ErrorHandler } from '@angular/core';
import { reportInvalidActions } from '../src/effect_notification';

describe('reportInvalidActions', () => {
  it('does nothing for a valid action', () => {
    const reporter = { handleError: vi.fn() } as unknown as ErrorHandler;

    reportInvalidActions(
      {
        effect: () => undefined as any,
        propertyName: 'doThing',
        sourceName: null,
        sourceInstance: {},
        notification: { kind: 'N', value: { type: 'THING' } } as any,
      },
      reporter
    );

    expect(reporter.handleError).not.toHaveBeenCalled();
  });

  it('reports when the value is not an action', () => {
    const reporter = { handleError: vi.fn() } as unknown as ErrorHandler;

    reportInvalidActions(
      {
        effect: () => undefined as any,
        propertyName: 'doThing',
        sourceName: 'Effect',
        sourceInstance: {},
        notification: { kind: 'N', value: 'not an action' } as any,
      },
      reporter
    );

    expect(reporter.handleError).toHaveBeenCalledOnce();
    expect(reporter.handleError).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('doThing') })
    );
  });

  it('reports null and function values as invalid actions', () => {
    const reporter = { handleError: vi.fn() } as unknown as ErrorHandler;

    reportInvalidActions(
      {
        effect: () => undefined as any,
        propertyName: 'doThing',
        sourceName: null,
        sourceInstance: {},
        notification: { kind: 'N', value: null } as any,
      },
      reporter
    );

    reportInvalidActions(
      {
        effect: () => undefined as any,
        propertyName: 'doThing',
        sourceName: null,
        sourceInstance: {},
        notification: { kind: 'N', value: () => undefined } as any,
      },
      reporter
    );

    expect(reporter.handleError).toHaveBeenCalledTimes(2);
  });

  it('does nothing for a non-next notification', () => {
    const reporter = { handleError: vi.fn() } as unknown as ErrorHandler;

    reportInvalidActions(
      {
        effect: () => undefined as any,
        propertyName: 'doThing',
        sourceName: null,
        sourceInstance: {},
        notification: { kind: 'E', value: 'not an action' } as any,
      },
      reporter
    );

    expect(reporter.handleError).not.toHaveBeenCalled();
  });
});
