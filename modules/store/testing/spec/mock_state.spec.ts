import { TestBed } from '@angular/core/testing';
import { firstValueFrom, skip } from 'rxjs';
import { MockState } from '../index';

describe('MockState', () => {
  it('starts empty and reports its current value', () => {
    const state = TestBed.configureTestingModule({
      providers: [MockState],
    }).inject(MockState);

    expect(state.value).toEqual({});
  });

  it('emits a new value through state$', async () => {
    const state = TestBed.configureTestingModule({
      providers: [MockState],
    }).inject(MockState);

    const next = firstValueFrom(state.state$.pipe(skip(1)));
    state.next({ count: 3 });

    await expect(next).resolves.toEqual({ count: 3 });
    expect(state.value).toEqual({ count: 3 });
  });

  it('exposes the current value through its signal', () => {
    const state = TestBed.configureTestingModule({
      providers: [MockState<number>],
    }).inject(MockState);

    state.next(42);

    expect(state.state()).toBe(42);
  });
});
