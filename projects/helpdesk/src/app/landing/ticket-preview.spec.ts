import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { landingFeature, LandingState } from './landing.feature';
import { showcaseTickets } from './showcase-tickets';
import { TicketPreview } from './ticket-preview';

const now = new Date('2026-10-02T12:00:00.000Z');

describe('TicketPreview', () => {
  const tickets = showcaseTickets(now);
  let fixture: ComponentFixture<TicketPreview>;

  afterEach(() => {
    vi.useRealTimers();
  });

  function render(
    loadState: LandingState['loadState'],
    visible = tickets
  ): HTMLElement {
    vi.useFakeTimers({ now });
    TestBed.configureTestingModule({ providers: [provideMockStore()] });
    const store = TestBed.inject(MockStore);
    store.overrideSelector(landingFeature.selectLoadState, loadState);
    store.overrideSelector(landingFeature.selectAllTickets, visible);

    fixture = TestBed.createComponent(TicketPreview);
    fixture.detectChanges();
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

  // Only what the app's own ticket table shows: it has no queue column.
  it("shows each ticket's requester, and not its queue", () => {
    const first = render('loaded').querySelector('li .meta')?.textContent;

    expect(first).toContain('Ada Lovelace');
    expect(first).not.toContain('Accounts');
  });

  it('counts the tickets it shows', () => {
    expect(
      render('loaded', tickets.slice(0, 2))
        .querySelector('.count')
        ?.textContent?.replace(/\s+/g, ' ')
        .trim()
    ).toBe('Example data · 2 tickets');
  });

  it.each(['loading', 'failed'] as const)(
    'gives no count while %s, only that it is example data',
    (loadState) => {
      expect(
        render(loadState, []).querySelector('.count')?.textContent?.trim()
      ).toBe('Example data');
    }
  );

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

  // A name only reaches a screen reader on an element with a role. An h3:
  // the card sits under its band's h2 on the landing page.
  it('is a region labelled by its heading', () => {
    const card = render('loaded');

    expect(card.querySelector('mat-card')?.getAttribute('role')).toBe('region');
    expect(
      card.querySelector('mat-card')?.getAttribute('aria-labelledby')
    ).toBe(card.querySelector('h3')?.id);
    expect(card.querySelector('h3')?.textContent).toBe('My tickets');
  });

  it('opens a ticket to show its description, and closes it again', () => {
    const card = render('loaded');
    const subject = card.querySelector<HTMLButtonElement>('li button.subject');
    const description = card.querySelector<HTMLElement>('li .description');

    expect(subject?.getAttribute('aria-expanded')).toBe('false');
    expect(subject?.getAttribute('aria-controls')).toBe(description?.id);
    expect(description?.hidden).toBe(true);

    subject?.click();
    fixture.detectChanges();
    expect(subject?.getAttribute('aria-expanded')).toBe('true');
    expect(description?.hidden).toBe(false);
    expect(description?.textContent).toContain('The reset link worked');

    subject?.click();
    fixture.detectChanges();
    expect(description?.hidden).toBe(true);
  });

  it('keeps the SLA labels current while it is shown', () => {
    const card = render('loaded');

    vi.advanceTimersByTime(60_000);
    fixture.detectChanges();

    expect(card.querySelector('li .sla')?.textContent).toBe('Overdue 26m');
  });
});
