import { ScannedActionsSubject } from '..';

describe(ScannedActionsSubject.name, () => {
  it('should emit actions pushed via next() to asObservable() subscribers', () => {
    const scannedActionsSubject = new ScannedActionsSubject();
    const seen: unknown[] = [];

    scannedActionsSubject
      .asObservable()
      .subscribe((action) => seen.push(action));
    scannedActionsSubject.next({ type: 'FIRST' });
    scannedActionsSubject.next({ type: 'SECOND' });

    expect(seen).toEqual([{ type: 'FIRST' }, { type: 'SECOND' }]);
  });

  it('should not replay the last action to a new subscriber', () => {
    const scannedActionsSubject = new ScannedActionsSubject();
    const seen: unknown[] = [];

    scannedActionsSubject.next({ type: 'BEFORE_SUBSCRIBE' });
    scannedActionsSubject
      .asObservable()
      .subscribe((action) => seen.push(action));

    expect(seen).toEqual([]);
  });

  it('should complete asObservable() on ngOnDestroy', () => {
    const scannedActionsSubject = new ScannedActionsSubject();
    let completed = false;

    scannedActionsSubject.asObservable().subscribe({
      complete: () => (completed = true),
    });
    scannedActionsSubject.ngOnDestroy();

    expect(completed).toBe(true);
  });
});
