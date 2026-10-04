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

  function render(tickets: TicketDto[], actionLabel: string | null = null) {
    const fixture = TestBed.createComponent(TicketTable);
    fixture.componentRef.setInput('tickets', tickets);
    fixture.componentRef.setInput('actionLabel', actionLabel);
    const actioned: TicketDto[] = [];
    fixture.componentInstance.action.subscribe((chosen) =>
      actioned.push(chosen)
    );
    fixture.detectChanges();
    const table = fixture.nativeElement as HTMLElement;
    return {
      /** The tickets whose action button was clicked, in order. */
      actioned,
      /** The rows' action buttons. */
      actionButtons: () => [
        ...table.querySelectorAll<HTMLButtonElement>(
          'td.mat-column-action button'
        ),
      ],
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

  it('says "Finished" for resolved and closed tickets, not how overdue they are', () => {
    const { rows, classesIn } = render([
      ticket(1312, '2026-08-01T12:00:00.000Z', { status: 'closed' }),
      ticket(1290, '2026-10-01T12:00:00.000Z', { status: 'resolved' }),
      ticket(1003, '2026-10-03T10:00:00.000Z'),
    ]);

    expect(rows().map((cells) => cells.at(-1))).toEqual([
      'Finished',
      'Finished',
      'Overdue 2h',
    ]);
    expect(
      classesIn('due').map((classes) => classes.contains('overdue'))
    ).toEqual([false, false, true]);
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

  describe('row action', () => {
    it('has no action column without a label', () => {
      const { headers, actionButtons } = render([ticket(1001, null)]);

      expect(actionButtons()).toEqual([]);
      expect(headers()).toHaveLength(6);
    });

    it('ends each row with a button, named for its ticket', () => {
      const { actionButtons } = render(
        [ticket(1312, null), ticket(1045, null)],
        'Assign'
      );

      expect(
        actionButtons().map((button) => [
          button.textContent?.trim(),
          button.getAttribute('aria-label'),
        ])
      ).toEqual([
        ['Assign', 'Assign #1312'],
        ['Assign', 'Assign #1045'],
      ]);
    });

    it('gives a button only to the rows canAct allows', () => {
      const fixture = TestBed.createComponent(TicketTable);
      fixture.componentRef.setInput('tickets', [
        ticket(1001, null),
        ticket(1002, null, { status: 'closed' }),
      ]);
      fixture.componentRef.setInput('actionLabel', 'Reassign');
      fixture.componentRef.setInput(
        'canAct',
        (candidate: TicketDto) => candidate.status !== 'closed'
      );
      fixture.detectChanges();

      expect(
        [
          ...(fixture.nativeElement as HTMLElement).querySelectorAll(
            'td.mat-column-action'
          ),
        ].map((cell) => cell.querySelector('button')?.textContent?.trim())
      ).toEqual(['Reassign', undefined]);
    });

    it("emits the row's ticket when its button is clicked", () => {
      const tickets = [ticket(1312, null), ticket(1045, null)];
      const { actionButtons, actioned } = render(tickets, 'Reassign');

      actionButtons()[1].click();

      expect(actioned).toEqual([tickets[1]]);
    });

    it('emits the right ticket after sorting moves the rows', async () => {
      const tickets = [ticket(1003, null), ticket(1001, null)];
      const { actionButtons, actioned, clickHeader } = render(
        tickets,
        'Assign'
      );

      await clickHeader('#');
      actionButtons()[0].click();

      // #1001 now leads.
      expect(actioned).toEqual([tickets[1]]);
    });
  });

  describe('subject links', () => {
    /** Renders with each subject as a link, keeping what was opened. */
    function renderWithLinks(tickets: TicketDto[]) {
      const fixture = TestBed.createComponent(TicketTable);
      fixture.componentRef.setInput('tickets', tickets);
      fixture.componentRef.setInput('subjectLinks', true);
      const opened: TicketDto[] = [];
      fixture.componentInstance.open.subscribe((chosen) => opened.push(chosen));
      fixture.detectChanges();
      const links = [
        ...(
          fixture.nativeElement as HTMLElement
        ).querySelectorAll<HTMLButtonElement>(
          'td.mat-column-subject button.subject-link'
        ),
      ];
      return { opened, links };
    }

    it('opens the ticket whose subject is clicked', () => {
      const tickets = [ticket(1001, null), ticket(1002, null)];
      const { opened, links } = renderWithLinks(tickets);

      links[1].click();

      expect(opened).toEqual([tickets[1]]);
    });

    it('names the ticket each link opens', () => {
      const { links } = renderWithLinks([ticket(1001, null)]);

      expect(links[0].getAttribute('aria-label')).toBe(
        'Open #1001, Subject 1001'
      );
      expect(links[0].textContent?.trim()).toBe('Subject 1001');
    });

    it('keeps subjects as plain text without them', () => {
      const fixture = TestBed.createComponent(TicketTable);
      fixture.componentRef.setInput('tickets', [ticket(1001, null)]);
      fixture.detectChanges();
      const cell = (fixture.nativeElement as HTMLElement).querySelector(
        'td.mat-column-subject'
      );

      expect(cell?.querySelector('button')).toBeNull();
      expect(cell?.textContent?.trim()).toBe('Subject 1001');
    });
  });

  describe('status menu', () => {
    /** Renders with a Change status menu on each row. */
    function renderWithMenu(tickets: TicketDto[]) {
      const fixture = TestBed.createComponent(TicketTable);
      fixture.componentRef.setInput('tickets', tickets);
      fixture.componentRef.setInput('statusMenu', true);
      const changes: { ticket: TicketDto; status: string }[] = [];
      fixture.componentInstance.statusChange.subscribe((change) =>
        changes.push(change)
      );
      fixture.detectChanges();
      const table = fixture.nativeElement as HTMLElement;
      const menuButtons = () => [
        ...table.querySelectorAll<HTMLButtonElement>(
          'td.mat-column-statusMenu button'
        ),
      ];
      return {
        changes,
        menuButtons,
        /** Opens a row's menu and lists its choices, from the overlay. */
        openMenu: async (row: number) => {
          menuButtons()[row].click();
          fixture.detectChanges();
          await fixture.whenStable();
          return [
            ...document.querySelectorAll<HTMLButtonElement>(
              '.mat-mdc-menu-panel button[mat-menu-item]'
            ),
          ];
        },
      };
    }

    afterEach(() => {
      // Close any menu left open, so the next test starts clean.
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      document
        .querySelectorAll('.cdk-overlay-container')
        .forEach((container) => container.replaceChildren());
    });

    it('has no menu unless asked', () => {
      expect(render([ticket(1001, null)]).headers()).toHaveLength(6);
    });

    it.each([
      ['new', ['Open', 'Closed']],
      ['open', ['Pending', 'Resolved', 'Closed']],
      ['pending', ['Open', 'Resolved', 'Closed']],
      ['resolved', ['Open', 'Closed']],
    ] as const)(
      'offers a %s ticket only the moves the workflow allows',
      async (status, labels) => {
        const { openMenu } = renderWithMenu([ticket(1001, null, { status })]);

        const choices = await openMenu(0);

        expect(choices.map((choice) => choice.textContent?.trim())).toEqual(
          labels
        );
      }
    );

    it('gives a closed ticket no menu', () => {
      const { menuButtons } = renderWithMenu([
        ticket(1001, null),
        ticket(1002, null, { status: 'closed' }),
      ]);

      expect(
        menuButtons().map((button) => button.getAttribute('aria-label'))
      ).toEqual(['Change status of #1001']);
    });

    it('emits the ticket and the status chosen', async () => {
      const tickets = [ticket(1001, null), ticket(1312, null)];
      const { openMenu, changes } = renderWithMenu(tickets);

      const choices = await openMenu(1);
      choices
        .find((choice) => choice.textContent?.trim() === 'Resolved')
        ?.click();

      expect(changes).toEqual([{ ticket: tickets[1], status: 'resolved' }]);
    });
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
