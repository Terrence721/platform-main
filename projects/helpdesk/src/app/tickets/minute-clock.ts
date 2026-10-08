import { DestroyRef, inject, type Signal, signal } from '@angular/core';

/** How often the clock ticks: time left reads in whole minutes. */
export const MINUTE = 60_000;

/**
 * Now, to the minute, for a component that shows time left: a page or a
 * popup can stay open a long while, so what it shows keeps up by itself,
 * and a ticket that falls overdue turns red without a reload. The clock
 * stops when the component goes away. Call it where `inject` works (a
 * field, or the constructor).
 */
export function minuteClock(): Signal<Date> {
  const now = signal(new Date());
  const ticking = setInterval(() => now.set(new Date()), MINUTE);
  inject(DestroyRef).onDestroy(() => clearInterval(ticking));
  return now.asReadonly();
}
