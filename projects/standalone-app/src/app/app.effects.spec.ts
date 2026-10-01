import { TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { provideMockActions } from '@ngrx/effects/testing';
import { Action } from '@ngrx/store';
import { of } from 'rxjs';
import { showErrors } from './app.effects';

describe('showErrors', () => {
  const open = vi.fn();

  function run(...actions: Action[]) {
    TestBed.configureTestingModule({
      providers: [
        provideMockActions(of(...actions)),
        { provide: MatSnackBar, useValue: { open } },
      ],
    });

    TestBed.runInInjectionContext(() => showErrors()).subscribe();
  }

  beforeEach(() => open.mockClear());

  it('opens a snack bar with the message of an action with a string error', () => {
    run({
      type: '[Books API] Load Failure',
      error: 'Books failed to load',
    } as Action);

    expect(open).toHaveBeenCalledExactlyOnceWith(
      'Books failed to load',
      'Dismiss',
      { duration: 5000 }
    );
  });

  it('ignores actions without an error', () => {
    run({ type: '[Books API] Load Success' });

    expect(open).not.toHaveBeenCalled();
  });

  it('ignores an error that is not a string', () => {
    run({ type: '[Books API] Load Failure', error: new Error('x') } as Action);

    expect(open).not.toHaveBeenCalled();
  });

  it('shows one snack bar per error action', () => {
    run(
      { type: 'First Failure', error: 'first' } as Action,
      { type: 'Some Success' },
      { type: 'Second Failure', error: 'second' } as Action
    );

    expect(open.mock.calls.map(([message]) => message)).toEqual([
      'first',
      'second',
    ]);
  });

  // It passes error actions straight through, so dispatching them would loop.
  it('does not dispatch actions', () => {
    expect(Reflect.get(showErrors, '__@ngrx/effects_create__')).toEqual({
      dispatch: false,
      functional: true,
      useEffectsErrorHandler: true,
    });
  });
});
