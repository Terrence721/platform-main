import type { CurrentUser, LiveEvent } from '@helpdesk/contract';
import { concerns, type LiveAudience, LiveHub } from './live-hub';

const sam: CurrentUser = {
  id: 'sam.rivera',
  name: 'Sam Rivera',
  role: 'agent',
  teamId: 'atlas',
};
const benny: CurrentUser = { ...sam, id: 'benny.lind', name: 'Benny Lind' };
const bea: CurrentUser = {
  id: 'bea.quinn',
  name: 'Bea Quinn',
  role: 'agent',
  teamId: 'beacon',
};
const chris: CurrentUser = {
  id: 'chris.taylor',
  name: 'Chris Taylor',
  role: 'supervisor',
  teamId: 'atlas',
};
const nina: CurrentUser = {
  id: 'nina.patel',
  name: 'Nina Patel',
  role: 'supervisor',
  teamId: 'beacon',
};
const alex: CurrentUser = {
  id: 'alex.morgan',
  name: 'Alex Morgan',
  role: 'admin',
  teamId: null,
};

/** A ticket's audience: who held it, their teams, and if it was unassigned. */
const ticket = (
  holderIds: string[],
  teamIds: string[],
  unassigned = false
): LiveAudience => ({ kind: 'ticket', holderIds, teamIds, unassigned });

describe('concerns', () => {
  describe('a ticket Sam holds (Atlas)', () => {
    const audience = ticket(['sam.rivera'], ['atlas']);

    it.each([
      ['Sam, who holds it', sam, true],
      ['Benny, on the same team', benny, false],
      ['Bea, on another team', bea, false],
      ['Chris, who leads Atlas', chris, true],
      ['Nina, who leads Beacon', nina, false],
      ['Alex, an admin', alex, false],
    ])('concerns %s: %s', (_, user, expected) => {
      expect(concerns(audience, user)).toBe(expected);
    });
  });

  it('concerns both agents and both teams when a ticket moves between them', () => {
    // Reassigned from Sam (Atlas) to Bea (Beacon).
    const audience = ticket(['sam.rivera', 'bea.quinn'], ['atlas', 'beacon']);

    expect(
      [sam, benny, bea, chris, nina, alex].map((user) =>
        concerns(audience, user)
      )
    ).toEqual([true, false, true, true, true, false]);
  });

  it('concerns every agent and supervisor when unassigned work changes', () => {
    // Taken by Sam: it was work anyone could take.
    const audience = ticket(['sam.rivera'], ['atlas'], true);

    expect(
      [sam, benny, bea, chris, nina, alex].map((user) =>
        concerns(audience, user)
      )
    ).toEqual([true, true, true, true, true, false]);
  });

  it('concerns admins and supervisors when accounts change, not agents', () => {
    const audience: LiveAudience = { kind: 'accounts' };

    expect(
      [sam, chris, nina, alex].map((user) => concerns(audience, user))
    ).toEqual([false, true, true, true]);
  });

  it('concerns a supervisor on no team only with unassigned work', () => {
    const noTeam: CurrentUser = { ...chris, id: 'old.lead', teamId: null };

    expect(concerns(ticket(['sam.rivera'], ['atlas']), noTeam)).toBe(false);
    expect(concerns(ticket([], [], true), noTeam)).toBe(true);
  });
});

describe('LiveHub', () => {
  const event: LiveEvent = { type: 'ticket', ticketId: 'ticket-1' };
  /** A session that outlasts every test. */
  const later = () => new Date(Date.now() + 60 * 60_000);

  /** What `user` hears while `act` runs. */
  function heardBy(
    user: CurrentUser,
    events: LiveHub,
    act: () => void
  ): LiveEvent[] {
    const heard: LiveEvent[] = [];
    const subscription = events
      .for(user, later())
      .subscribe((e) => heard.push(e));
    act();
    subscription.unsubscribe();
    return heard;
  }

  it('hands on only the event, not who it concerns', () => {
    const events = new LiveHub();

    const heard = heardBy(sam, events, () =>
      events.publish({ event, audience: ticket(['sam.rivera'], ['atlas']) })
    );

    expect(heard).toEqual([event]);
  });

  it('hands each person only what concerns them', () => {
    const events = new LiveHub();
    const forSam: LiveEvent[] = [];
    const forBea: LiveEvent[] = [];
    const subscriptions = [
      events.for(sam, later()).subscribe((e) => forSam.push(e)),
      events.for(bea, later()).subscribe((e) => forBea.push(e)),
    ];

    events.publish({ event, audience: ticket(['sam.rivera'], ['atlas']) });
    events.publish({
      event: { type: 'message', ticketId: 'ticket-2' },
      audience: ticket(['bea.quinn'], ['beacon']),
    });

    expect(forSam).toEqual([event]);
    expect(forBea).toEqual([{ type: 'message', ticketId: 'ticket-2' }]);
    subscriptions.forEach((s) => s.unsubscribe());
  });

  it('hands on nothing from before someone listened', () => {
    const events = new LiveHub();
    events.publish({ event, audience: ticket([], [], true) });

    expect(heardBy(sam, events, () => undefined)).toEqual([]);
  });

  // A stream must not outlive what it was opened for (#1073): the browser
  // reconnects, and the sign-in check then judges the person afresh.
  describe('ending streams', () => {
    afterEach(() => vi.useRealTimers());

    /** A stream for `user`, with what it heard and whether it ended. */
    function listen(events: LiveHub, user: CurrentUser, endsAt: Date) {
      const stream = { heard: [] as LiveEvent[], ended: false };
      events.for(user, endsAt).subscribe({
        next: (e) => stream.heard.push(e),
        complete: () => (stream.ended = true),
      });
      return stream;
    }

    it('ends a stream when its session does, and not before', () => {
      vi.useFakeTimers();
      const events = new LiveHub();
      const stream = listen(events, sam, new Date(Date.now() + 60_000));

      vi.advanceTimersByTime(59_999);
      expect(stream.ended).toBe(false);
      vi.advanceTimersByTime(1);
      expect(stream.ended).toBe(true);

      events.publish({ event, audience: ticket([], [], true) });
      expect(stream.heard).toEqual([]);
    });

    it('ends a stream at once if its session has already ended', () => {
      vi.useFakeTimers();
      const stream = listen(new LiveHub(), sam, new Date(Date.now() - 1));

      vi.advanceTimersByTime(0);
      expect(stream.ended).toBe(true);
    });

    it("ends all of a person's streams when their account changes, and only theirs", () => {
      const events = new LiveHub();
      const samTab = listen(events, sam, later());
      const samOtherTab = listen(events, sam, later());
      const bennyTab = listen(events, benny, later());

      events.endStreamsOf('sam.rivera');
      events.publish({ event, audience: ticket([], [], true) });

      expect([samTab.ended, samOtherTab.ended]).toEqual([true, true]);
      expect(samTab.heard).toEqual([]);
      expect(bennyTab).toEqual({ heard: [event], ended: false });
    });
  });
});
