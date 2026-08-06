import { Injectable, Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable()
export class MockState<T> {
  private readonly stateSubject: BehaviorSubject<T>;

  readonly state$: Observable<T>;

  /**
   * @internal
   */
  readonly state: Signal<T>;

  get value(): T {
    return this.stateSubject.value;
  }

  constructor() {
    this.stateSubject = new BehaviorSubject<T>(<T>{});
    this.state$ = this.stateSubject.asObservable();
    this.state = toSignal(this.state$, {
      manualCleanup: true,
      requireSync: true,
    });
  }

  next(state: T) {
    this.stateSubject.next(state);
  }
}
