import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import type { MemberHistory, TicketDto } from '@helpdesk/contract';
import { MemberHistoryDialog, memberHistoryApi } from './member-history.dialog';

const benny = { id: 'benny.lind', name: 'Benny Lind' };

/** A ticket with just what the history's table shows. */
const ticket = (ticketNumber: number): TicketDto => ({
  id: `ticket-${ticketNumber}`,
  ticketNumber,
  subject: `Subject ${ticketNumber}`,
  description: '',
  status: 'closed',
  priority: 'normal',
  requester: {
    id: 'customer-1',
    name: 'Dana Whitfield',
    email: 'dana.whitfield@example.com',
  },
  assignee: benny,
  queue: { id: 'accounts', name: 'Accounts' },
  tags: [],
  slaDueAt: null,
  createdAt: '2026-08-01T08:00:00.000Z',
  updatedAt: '2026-08-02T08:00:00.000Z',
});

const history: MemberHistory = {
  member: benny,
  // Midday UTC, so it is 3 July in every time zone the test may run in.
  since: '2026-07-03T12:00:00.000Z',
  summary: { assigned: 24, finished: 19, open: 5, onTime: 15, late: 4 },
  tickets: [ticket(1290), ticket(1201)],
};

describe('MemberHistoryDialog', () => {
  const dialogRef = { close: vi.fn() };

  afterEach(() => TestBed.inject(HttpTestingController).verify());

  function render() {
    dialogRef.close.mockClear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: MAT_DIALOG_DATA, useValue: benny },
        { provide: MatDialogRef, useValue: dialogRef },
      ],
    });
    const fixture = TestBed.createComponent(MemberHistoryDialog);
    fixture.detectChanges();
    const dialog = fixture.nativeElement as HTMLElement;
    const http = TestBed.inject(HttpTestingController);
    return {
      dialog,
      http,
      text: (selector: string) =>
        dialog.querySelector(selector)?.textContent?.trim(),
      /** Answers the dialog's request for the history, then renders. */
      answer: (body: MemberHistory | null, status = 200) => {
        http
          .expectOne(memberHistoryApi('benny.lind'))
          .flush(body, { status, statusText: status === 200 ? 'OK' : 'Error' });
        fixture.detectChanges();
      },
      detectChanges: () => fixture.detectChanges(),
    };
  }

  it("is titled with the member's name, and loads their history once", () => {
    const { text, dialog, answer } = render();

    expect(text('h2')).toBe('Benny Lind');
    expect(
      dialog.querySelector('mat-spinner')?.getAttribute('aria-label')
    ).toBe('Loading the history of Benny Lind');
    answer(history);
  });

  it('shows the period, then how the tickets add up, in order', () => {
    const { text, dialog, answer } = render();

    answer(history);

    expect(text('.period')).toBe('Last 3 months · since 3 Jul 2026');
    expect(
      [...dialog.querySelectorAll('.counts > div')].map((count) => [
        count.querySelector('dt')?.textContent?.trim(),
        count.querySelector('dd')?.textContent?.trim(),
      ])
    ).toEqual([
      ['Assigned', '24'],
      ['Finished', '19'],
      ['Open', '5'],
      ['On time', '15'],
      ['Late', '4'],
    ]);
  });

  it('says how on time and late are judged', () => {
    const { text, answer } = render();

    answer(history);

    expect(text('.note')?.replace(/\s+/g, ' ')).toBe(
      "On time and late compare each finished ticket's last change with its due time."
    );
  });

  it('lists the tickets from the period', () => {
    const { dialog, answer } = render();

    answer(history);

    expect(
      [...dialog.querySelectorAll('td.mat-column-ticketNumber')].map((cell) =>
        cell.textContent?.trim()
      )
    ).toEqual(['#1290', '#1201']);
  });

  it('says so when there are no tickets in the period', () => {
    const { text, dialog, answer } = render();

    answer({
      ...history,
      summary: { assigned: 0, finished: 0, open: 0, onTime: 0, late: 0 },
      tickets: [],
    });

    expect(text('.message')).toBe('No tickets in the last 3 months.');
    expect(dialog.querySelector('hd-ticket-table')).toBeNull();
  });

  it('says when the history could not be loaded, and tries again', () => {
    const { dialog, answer, http, detectChanges } = render();

    answer(null, 500);

    const message = dialog.querySelector('.message');
    expect(message?.getAttribute('role')).toBe('alert');
    expect(message?.textContent).toContain("This history couldn't be loaded.");
    message?.querySelector('button')?.click();
    detectChanges();
    expect(dialog.querySelector('mat-spinner')).not.toBeNull();
    http.expectOne(memberHistoryApi('benny.lind')).flush(history);
  });

  it('closes with its Close button', () => {
    const { dialog, answer } = render();
    answer(history);

    dialog.querySelector<HTMLButtonElement>('[aria-label="Close"]')?.click();

    expect(dialogRef.close).toHaveBeenCalledOnce();
  });
});

describe('memberHistoryApi', () => {
  it('keeps user IDs safe in the address', () => {
    expect(memberHistoryApi('a/b')).toBe(
      '/api/teams/mine/members/a%2Fb/history'
    );
  });
});
