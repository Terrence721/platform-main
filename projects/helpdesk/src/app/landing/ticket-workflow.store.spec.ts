import { TestBed } from '@angular/core/testing';
import { TICKET_STATUS_TRANSITIONS, TICKET_STATUSES } from '@helpdesk/contract';
import { STATUS_LABELS } from '../tickets/status-labels';
import { STATUS_GUIDE, TicketWorkflowStore } from './ticket-workflow.store';

describe('TicketWorkflowStore', () => {
  function setUp() {
    TestBed.configureTestingModule({ providers: [TicketWorkflowStore] });
    return TestBed.inject(TicketWorkflowStore);
  }

  const reachable = (store: ReturnType<typeof setUp>) =>
    store
      .steps()
      .filter((step) => step.reachable)
      .map(({ status }) => status);

  it('starts at New, from which a ticket can be opened or closed', () => {
    const store = setUp();

    expect(store.picked()).toBe('new');
    expect(reachable(store)).toEqual(['open', 'closed']);
    expect(store.isFinal()).toBe(false);
  });

  it('shows every status, in the order a ticket goes through them', () => {
    expect(
      setUp()
        .steps()
        .map(({ label }) => label)
    ).toEqual(['New', 'Open', 'Pending', 'Resolved', 'Closed']);
  });

  it('marks only the picked status as picked', () => {
    const store = setUp();
    store.select('pending');

    expect(
      store
        .steps()
        .filter((step) => step.picked)
        .map(({ status }) => status)
    ).toEqual(['pending']);
  });

  it.each(TICKET_STATUSES)(
    'from %s, offers exactly the moves the contract allows',
    (status) => {
      const store = setUp();
      store.select(status);

      expect(reachable(store)).toEqual(
        TICKET_STATUSES.filter((to) =>
          TICKET_STATUS_TRANSITIONS[status].includes(to)
        )
      );
    }
  );

  it('explains the picked status', () => {
    const store = setUp();
    store.select('resolved');

    expect(store.guide()).toEqual({
      label: 'Resolved',
      icon: 'task_alt',
      meaning: "Answered. If the customer says it isn't fixed, reopen it.",
    });
  });

  it('treats Closed as final: a ticket goes nowhere from there', () => {
    const store = setUp();
    store.select('closed');

    expect(store.isFinal()).toBe(true);
    expect(reachable(store)).toEqual([]);
  });
});

describe('STATUS_GUIDE', () => {
  it.each(TICKET_STATUSES)(
    'gives %s a label, an icon and a sentence',
    (status) => {
      const { label, icon, meaning } = STATUS_GUIDE[status];

      expect(label.length).toBeGreaterThan(0);
      expect(icon).toMatch(/^[a-z_]+$/);
      expect(meaning).toMatch(/\.$/);
    }
  );

  // The public page, beside the live demo, says only what the app does
  // (#1024): tickets don't come from email, and customers don't reply in it.
  it.each(TICKET_STATUSES)(
    'explains %s with nothing the app lacks',
    (status) => {
      expect(STATUS_GUIDE[status].meaning).not.toMatch(
        /email|their reply moves/i
      );
    }
  );

  it.each(TICKET_STATUSES)('labels %s as the app does everywhere', (status) => {
    expect(STATUS_GUIDE[status].label).toBe(STATUS_LABELS[status]);
  });
});
