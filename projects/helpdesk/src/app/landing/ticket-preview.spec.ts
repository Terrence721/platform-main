import { TestBed } from '@angular/core/testing';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { landingFeature, LandingState } from './landing.feature';
import { showcaseTickets } from './showcase-tickets';
import { slaLabel, TicketPreview } from './ticket-preview';

const now = new Date('2026-10-02T12:00:00.000Z');
const at = (minutes: number) =>
  new Date(now.getTime() + minutes * 60_000).toISOString();

describe('slaLabel', () => {
  it.each([
    [null, 'No SLA', 'none'],
    [at(-25), 'Overdue 25m', 'overdue'],
    [at(-2 * 24 * 60), 'Overdue 2d', 'overdue'],
    [at(0), 'Due in 0m', 'soon'],
    [at(2 * 60 + 15), 'Due in 2h 15m', 'soon'],
    [at(4 * 60), 'Due in 4h', 'soon'],
    [at(4 * 60 + 1), 'Due in 4h 1m', 'ok'],
    [at(28 * 60), 'Due in 1d 4h', 'ok'],
    [at(3 * 24 * 60), 'Due in 3d', 'ok'],
  ] as const)('labels %s as "%s" (%s)', (dueAt, text, tone) => {
    expect(slaLabel(dueAt, now)).toEqual({ text, tone });
  });
});

describe('TicketPreview', () => {
  const tickets = showcaseTickets(now);

  function render(
    loadState: LandingState['loadState'],
    visible = tickets
  ): HTMLElement {
    vi.useFakeTimers({ now, toFake: ['Date'] });
    TestBed.configureTestingModule({ providers: [provideMockStore()] });
    const store = TestBed.inject(MockStore);
    store.overrideSelector(landingFeature.selectLoadState, loadState);
    store.overrideSelector(landingFeature.selectVisibleTickets, visible);

    const fixture = TestBed.createComponent(TicketPreview);
    fixture.detectChanges();
    vi.useRealTimers();
    return fixture.nativeElement as HTMLElement;
  }

  const rows = (card: HTMLElement) =>
    [...card.querySelectorAll('li')].map((row) =>
      [...row.querySelectorAll('.number, .subject, .sla, mat-chip')].map(
        (cell) => cell.textContent?.trim()
      )
    );

  it('lists the tickets in the order the store gives them', () => {
    expect(rows(render('loaded'))).toEqual([
      ['#1042', 'Cannot sign in after password reset', 'Overdue 25m', 'urgent'],
      ['#1039', 'Refund for a double charge', 'Due in 2h', 'high'],
      [
        '#1035',
        'Export to CSV leaves out the last row',
        'Due in 1d 4h',
        'normal',
      ],
      ['#1031', 'How do I add a second admin?', 'Due in 3d', 'low'],
    ]);
  });

  it('colors each SLA label by how urgent it is', () => {
    const tones = [...render('loaded').querySelectorAll('.sla')].map((label) =>
      label.className.replace('sla', '').trim()
    );

    expect(tones).toEqual(['overdue', 'soon', 'ok', 'ok']);
  });

  it('shows each ticket queue and requester', () => {
    const first = render('loaded').querySelector('li .meta')?.textContent;

    expect(first).toContain('Accounts');
    expect(first).toContain('Ada Lovelace');
  });

  it('counts the tickets it shows', () => {
    expect(
      render('loaded', tickets.slice(0, 2)).querySelector('.count')?.textContent
    ).toContain('Example data · 2 tickets');
  });

  it('says so while the tickets load', () => {
    const card = render('loading', []);

    expect(card.querySelector('.message')?.textContent).toBe('Loading…');
    expect(card.querySelector('li')).toBeNull();
  });

  it('says so when the tickets could not be loaded', () => {
    expect(render('failed', []).querySelector('.message')?.textContent).toBe(
      'The example tickets could not be loaded.'
    );
  });

  it('is labelled by its heading', () => {
    const card = render('loaded');

    expect(
      card.querySelector('mat-card')?.getAttribute('aria-labelledby')
    ).toBe(card.querySelector('h2')?.id);
    expect(card.querySelector('h2')?.textContent).toBe('My tickets');
  });
});
