import { Subject } from 'rxjs';
import { debounceSync } from '../src/debounce-sync';

function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => queueMicrotask(resolve));
}

describe('debounceSync', () => {
  it('collapses multiple synchronous next() calls into a single emission of the latest value', async () => {
    const source = new Subject<number>();
    const results: number[] = [];
    source.pipe(debounceSync()).subscribe((v) => results.push(v));

    source.next(1);
    source.next(2);
    source.next(3);
    expect(results).toEqual([]);

    await flushMicrotasks();
    expect(results).toEqual([3]);
  });

  it('emits the latest value exactly once when the source completes while an emission is pending', async () => {
    const source = new Subject<number>();
    const results: number[] = [];
    let completed = false;
    source.pipe(debounceSync()).subscribe({
      next: (v) => results.push(v),
      complete: () => (completed = true),
    });

    source.next(1);
    source.next(2);
    source.complete();

    expect(results).toEqual([2]);
    expect(completed).toBe(true);

    // the asapScheduler job queued by the second next() must be cancelled by
    // completion's automatic teardown, or this would emit 2 a second time
    await flushMicrotasks();
    expect(results).toEqual([2]);
  });

  it('does not emit an extra value on complete when no emission is pending', async () => {
    const source = new Subject<number>();
    const results: number[] = [];
    let completed = false;
    source.pipe(debounceSync()).subscribe({
      next: (v) => results.push(v),
      complete: () => (completed = true),
    });

    source.next(1);
    await flushMicrotasks();
    expect(results).toEqual([1]);

    source.complete();
    expect(results).toEqual([1]);
    expect(completed).toBe(true);
  });

  it('propagates errors', () => {
    const source = new Subject<number>();
    const error = new Error('boom');
    let received: unknown;
    source.pipe(debounceSync()).subscribe({ error: (e) => (received = e) });

    source.error(error);

    expect(received).toBe(error);
  });
});
