import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { TestBed } from '@angular/core/testing';
import { MatSortHarness } from '@angular/material/sort/testing';
import type { TicketDto } from '@helpdesk/contract';
import { TicketTable } from './ticket-table';

const NOW = new Date('2026-10-03T12:00:00.000Z');

/** A ticket due at `slaDueAt`, with what these tests look at. */
const ticket = (
  ticketNumber: number,
  slaDueAt: string | null,
  changes: Partial<TicketDto> = {}
): TicketDto => ({
  id: `ticket-${ticketNumber}`,
  ticketNumber,
  subject: `Subject ${ticketNumber}`,
  description: '',
  status: 'open',
  priority: 'normal',
  requester: {
    id: 'customer-1',
    name: 'Dana Whitfield',
    email: 'dana.whitfield@example.com',
  },
  assignee: null,
  queue: { id: 'accounts', name: 'Accounts' },
  tags: [],
  slaDueAt,
  createdAt: '2026-10-01T08:00:00.000Z',
  updatedAt: '2026-10-01T08:00:00.000Z',
  ...changes,
});

describe('TicketTable', () => {
  beforeEach(() => {
    // Only Date: time left is measured from NOW.
    vi.useFakeTimers({ now: NOW, toFake: ['Date'] });
  });

  afterEach(() => vi.useRealTimers());

  function render(tickets: TicketDto[]) {
    const fixture = TestBed.createComponent(TicketTable);
    fixture.componentRef.setInput('tickets', tickets);
    fixture.detectChanges();
    const table = fixture.nativeElement as HTMLElement;
    return {
      headers: () =>
        [...table.querySelectorAll('th')].map((cell) =>
          cell.textContent?.trim()
        ),
      rows: () =>
        [...table.querySelectorAll('tr.mat-mdc-row')].map((row) =>
          [...row.querySelectorAll('td')].map((cell) =>
            cell.textContent?.trim()
          )
        ),
      /** The class list of each row's cell in `column`. */
      classesIn: (column: string) =>
        [...table.querySelectorAll(`td.mat-column-${column}`)].map(
          (cell) => cell.classList
        ),
      chips: () => [...table.querySelectorAll('mat-chip')],
      /** The ticket numbers shown, top to bottom. */
      order: () =>
        [...table.querySelectorAll('td.mat-column-ticketNumber')].map((cell) =>
          cell.textContent?.trim()
        ),
      /** Clicks the header of the column with this label. */
      clickHeader: async (label: string) => {
        const sort =
          await TestbedHarnessEnvironment.loader(fixture).getHarness(
            MatSortHarness
          );
        const [header] = await sort.getSortHeaders({ label });
        await header.click();
      },
    };
  }

  it('has a column for each thing a worker needs to pick a ticket', () => {
    expect(render([]).headers()).toEqual([
      '#',
      'Subject',
      'Customer',
      'Priority',
      'Status',
      'Due',
    ]);
  });

  it('shows the tickets in the order given', () => {
    const { rows } = render([
      ticket(1003, '2026-10-03T09:00:00.000Z', { priority: 'high' }),
      ticket(1001, null, { status: 'pending' }),
      ticket(1007, '2026-10-05T12:00:00.000Z', { status: 'new' }),
    ]);

    expect(rows()).toEqual([
      ['#1003', 'Subject 1003', 'Dana Whitfield', 'high', 'Open', 'Overdue 3h'],
      [
        '#1001',
        'Subject 1001',
        'Dana Whitfield',
        'normal',
        'Pending',
        'No SLA',
      ],
      ['#1007', 'Subject 1007', 'Dana Whitfield', 'normal', 'New', 'Due in 2d'],
    ]);
  });

  it('marks how each ticket stands against its SLA', () => {
    const { classesIn } = render([
      ticket(1001, '2026-10-03T11:00:00.000Z'), // an hour ago
      ticket(1002, '2026-10-03T14:00:00.000Z'), // in 2 hours
      ticket(1003, '2026-10-06T12:00:00.000Z'), // in 3 days
      ticket(1004, null),
    ]);

    expect(
      classesIn('due').map((classes) =>
        ['overdue', 'soon', 'ok', 'none'].find((tone) => classes.contains(tone))
      )
    ).toEqual(['overdue', 'soon', 'ok', 'none']);
  });

  it('shows priority as a chip, tinted for high and urgent', () => {
    const { chips } = render([
      ticket(1001, null, { priority: 'urgent' }),
      ticket(1002, null, { priority: 'high' }),
      ticket(1003, null, { priority: 'low' }),
    ]);

    expect(chips().map((chip) => chip.classList.contains('urgent'))).toEqual([
      true,
      false,
      false,
    ]);
    expect(chips().map((chip) => chip.classList.contains('high'))).toEqual([
      false,
      true,
      false,
    ]);
  });

  describe('sorting', () => {
    it('sorts by priority low to urgent, then reversed, then back to the order given', async () => {
      const { order, clickHeader } = render([
        ticket(1001, null, { priority: 'high' }),
        ticket(1002, null, { priority: 'low' }),
        ticket(1003, null, { priority: 'urgent' }),
        ticket(1004, null, { priority: 'normal' }),
      ]);

      await clickHeader('Priority');
      expect(order()).toEqual(['#1002', '#1004', '#1001', '#1003']);

      await clickHeader('Priority');
      expect(order()).toEqual(['#1003', '#1001', '#1004', '#1002']);

      await clickHeader('Priority');
      expect(order()).toEqual(['#1001', '#1002', '#1003', '#1004']);
    });

    it('sorts status in workflow order, not alphabetically', async () => {
      const { order, clickHeader } = render([
        ticket(1001, null, { status: 'closed' }),
        ticket(1002, null, { status: 'resolved' }),
        ticket(1003, null, { status: 'new' }),
      ]);

      await clickHeader('Status');

      // Alphabetically Closed would come first.
      expect(order()).toEqual(['#1003', '#1002', '#1001']);
    });

    it('sorts by due time, soonest first, no SLA last', async () => {
      const { order, clickHeader } = render([
        ticket(1001, null),
        ticket(1002, '2026-10-05T12:00:00.000Z'),
        ticket(1003, '2026-10-02T12:00:00.000Z'),
      ]);

      await clickHeader('Due');

      expect(order()).toEqual(['#1003', '#1002', '#1001']);
    });

    it('sorts ticket numbers as numbers, not text', async () => {
      const { order, clickHeader } = render([
        ticket(1001, null),
        ticket(999, null),
      ]);

      await clickHeader('#');

      // As text, "#1001" would come before "#999".
      expect(order()).toEqual(['#999', '#1001']);
    });
  });
});
