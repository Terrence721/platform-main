import type { DismissReason } from './customer-request';
import {
  FINISHED_STATUSES,
  isFinished,
  OPEN_WORK_STATUSES,
  type ReportsResponse,
  type RequestsReport,
} from './reports';
import { TICKET_STATUSES } from './ticket';

describe('open and finished work', () => {
  // Every page and query that sorts tickets into "still to do" and "done"
  // reads these two lists, so a new status must land in exactly one.
  it('splits every status between them, none left out and none in both', () => {
    const open: readonly string[] = OPEN_WORK_STATUSES;
    const finished: readonly string[] = FINISHED_STATUSES;

    expect([...open, ...finished].sort()).toEqual([...TICKET_STATUSES].sort());
    expect(open.filter((status) => finished.includes(status))).toEqual([]);
  });

  it('counts resolved and closed tickets as finished, and nothing else', () => {
    expect(TICKET_STATUSES.filter(isFinished)).toEqual(['resolved', 'closed']);
  });
});

// Customer requests in the Reports popup (#1026): the same for every
// scope, as a request belongs to no team until it becomes a ticket.
describe('the requests report', () => {
  it('comes with every report', () => {
    expectTypeOf<ReportsResponse['requests']>().toEqualTypeOf<RequestsReport>();
  });

  it('counts what arrived, became tickets, and is still waiting', () => {
    expectTypeOf<RequestsReport['received']>().toEqualTypeOf<number>();
    expectTypeOf<RequestsReport['turnedIntoTickets']>().toEqualTypeOf<number>();
    expectTypeOf<RequestsReport['waiting']>().toEqualTypeOf<number>();
  });

  it('counts what was dismissed by every reason, none left out', () => {
    expectTypeOf<RequestsReport['dismissed']>().toEqualTypeOf<
      Record<DismissReason, number>
    >();
  });

  it('gives the median time to a decision, or none when nothing was decided', () => {
    expectTypeOf<RequestsReport['medianHoursToDecision']>().toEqualTypeOf<
      number | null
    >();
  });
});
