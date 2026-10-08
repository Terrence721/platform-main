import { MINUTE } from './minute-clock';

/** How a ticket stands against its SLA, for its color. */
export type SlaTone = 'overdue' | 'soon' | 'ok' | 'none';

/** Due within this many minutes counts as "soon". */
const SOON_MINUTES = 4 * 60;

/** A duration in minutes as people read it: "25m", "2h", "1d 4h". */
function formatDuration(minutes: number): string {
  const days = Math.floor(minutes / (24 * 60));
  const hours = Math.floor((minutes % (24 * 60)) / 60);
  const rest = minutes % 60;
  if (days > 0) {
    return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  }
  if (hours > 0) {
    return rest > 0 ? `${hours}h ${rest}m` : `${hours}h`;
  }
  return `${rest}m`;
}

/**
 * How a ticket stands against its SLA at `now`, in words and as a tone:
 * for the ticket table, the ticket popup and the landing page's preview.
 */
export function slaLabel(
  slaDueAt: string | null,
  now: Date
): { text: string; tone: SlaTone } {
  if (slaDueAt === null) {
    return { text: 'No SLA', tone: 'none' };
  }
  const minutes = Math.round(
    (new Date(slaDueAt).getTime() - now.getTime()) / MINUTE
  );
  if (minutes < 0) {
    return { text: `Overdue ${formatDuration(-minutes)}`, tone: 'overdue' };
  }
  return {
    text: `Due in ${formatDuration(minutes)}`,
    tone: minutes <= SOON_MINUTES ? 'soon' : 'ok',
  };
}
