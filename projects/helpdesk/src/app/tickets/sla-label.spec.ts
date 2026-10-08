import { slaLabel } from './sla-label';

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
