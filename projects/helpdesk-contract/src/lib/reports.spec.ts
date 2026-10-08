import { FINISHED_STATUSES, isFinished, OPEN_WORK_STATUSES } from './reports';
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
