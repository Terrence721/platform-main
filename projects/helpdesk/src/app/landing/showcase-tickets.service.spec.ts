import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { showcaseTickets } from './showcase-tickets';
import { ShowcaseTicketsService } from './showcase-tickets.service';

describe('ShowcaseTicketsService', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('loads the showcase tickets', async () => {
    const service = TestBed.inject(ShowcaseTicketsService);
    const now = new Date('2026-10-02T12:00:00.000Z');
    vi.useFakeTimers({ now });

    expect(await firstValueFrom(service.load())).toEqual(showcaseTickets(now));
  });

  it('times them when subscribed to, not when load() is called', async () => {
    const service = TestBed.inject(ShowcaseTicketsService);
    vi.useFakeTimers({ now: new Date('2026-10-02T12:00:00.000Z') });
    const tickets$ = service.load();

    const later = new Date('2026-10-02T13:00:00.000Z');
    vi.setSystemTime(later);

    expect(await firstValueFrom(tickets$)).toEqual(showcaseTickets(later));
  });
});
