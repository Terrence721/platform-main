import { TICKET_STATUSES } from '@helpdesk/contract';
import { STATUS_LABELS } from './status-labels';

describe('STATUS_LABELS', () => {
  it('names every status, as the ticket screens show it', () => {
    expect(TICKET_STATUSES.map((status) => STATUS_LABELS[status])).toEqual([
      'New',
      'Open',
      'Pending',
      'Resolved',
      'Closed',
    ]);
  });
});
