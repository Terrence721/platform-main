import { TICKET_MESSAGE_MAX_LENGTH } from '@helpdesk/contract';
import { BadRequestException } from '@nestjs/common';
import {
  historySince,
  readAssigneeId,
  readCreateAccount,
  readCustomerRequest,
  readDismissal,
  readMessage,
  readSignIn,
  readStatus,
  readTurnIntoTicket,
  readUpdateAccount,
} from './request-bodies';

describe('readSignIn', () => {
  it('reads the user ID and password a body holds', () => {
    expect(
      readSignIn({ userId: 'sam.rivera', password: 'helpdesk-dev-only' })
    ).toEqual({ userId: 'sam.rivera', password: 'helpdesk-dev-only' });
  });

  it.each([
    ['no body', null],
    ['no fields', {}],
    ['fields that are not text', { userId: 7, password: ['x'] }],
  ])(
    'reads %s as empty strings, which then fail like a wrong password',
    (_, body) => {
      expect(readSignIn(body)).toEqual({ userId: '', password: '' });
    }
  );
});

describe('readMessage', () => {
  it('reads the kind and the text, trimmed', () => {
    expect(
      readMessage({ kind: 'note', body: '  Checked the logs.\n' })
    ).toEqual({ kind: 'note', body: 'Checked the logs.' });
  });

  it('keeps text right at the limit', () => {
    const body = 'x'.repeat(TICKET_MESSAGE_MAX_LENGTH);

    expect(readMessage({ kind: 'reply', body })).toEqual({
      kind: 'reply',
      body,
    });
  });

  it.each([
    ['no body', null],
    ['no kind', { body: 'Hello.' }],
    ['an unknown kind', { kind: 'email', body: 'Hello.' }],
  ])('refuses %s with 400', (_, body) => {
    expect(() => readMessage(body)).toThrow(BadRequestException);
    expect(() => readMessage(body)).toThrow('Choose reply or note.');
  });

  it.each([
    ['no text', { kind: 'reply' }],
    ['blank text', { kind: 'reply', body: ' \n\t ' }],
    ['text that is not a string', { kind: 'reply', body: 7 }],
  ])('refuses %s with 400', (_, body) => {
    expect(() => readMessage(body)).toThrow(BadRequestException);
    expect(() => readMessage(body)).toThrow('Write a message first.');
  });

  it('refuses text over the limit with 400', () => {
    const body = 'x'.repeat(TICKET_MESSAGE_MAX_LENGTH + 1);

    expect(() => readMessage({ kind: 'reply', body })).toThrow(
      `Keep the message to ${TICKET_MESSAGE_MAX_LENGTH} characters or fewer.`
    );
  });
});

describe('readStatus', () => {
  it('reads the status a body names', () => {
    expect(readStatus({ status: 'resolved' })).toBe('resolved');
  });

  it.each([
    ['no body', null],
    ['no status', {}],
    ['an unknown status', { status: 'done' }],
  ])('refuses %s with 400', (_, body) => {
    expect(() => readStatus(body)).toThrow(BadRequestException);
    expect(() => readStatus(body)).toThrow(
      'Choose new, open, pending, resolved or closed.'
    );
  });
});

describe('readAssigneeId', () => {
  it('reads the agent a body names', () => {
    expect(readAssigneeId({ assigneeId: 'benny.lind' })).toBe('benny.lind');
  });

  it.each([
    ['no body', null],
    ['no agent', {}],
    ['an agent that is not a user ID', { assigneeId: 'Benny Lind' }],
    ['an agent that is not text', { assigneeId: 7 }],
  ])('refuses %s with 400', (_, body) => {
    expect(() => readAssigneeId(body)).toThrow(BadRequestException);
    expect(() => readAssigneeId(body)).toThrow(
      'Choose an agent to assign the ticket to.'
    );
  });
});

const goodBody = {
  userId: 'nia.new',
  name: 'Nia New',
  role: 'agent',
  teamId: 'atlas',
  password: 'a-starting-password',
};

describe('readCreateAccount', () => {
  it('reads a good body, trimming the name', () => {
    expect(readCreateAccount({ ...goodBody, name: '  Nia New  ' })).toEqual(
      goodBody
    );
  });

  it('reads a missing team as none', () => {
    const { teamId: _, ...noTeam } = goodBody;

    expect(readCreateAccount({ ...noTeam, role: 'admin' }).teamId).toBeNull();
  });

  it.each([
    ['no body', null, 'Use a user ID'],
    ['a user ID with capitals', { userId: 'Nia.New' }, 'Use a user ID'],
    ['a user ID too short', { userId: 'ni' }, 'Use a user ID'],
    ['no name', { name: '   ' }, 'Enter a name of 1 to 100 characters.'],
    ['a name too long', { name: 'x'.repeat(101) }, 'Enter a name'],
    [
      'an unknown role',
      { role: 'customer' },
      'Choose agent, supervisor or admin.',
    ],
    ['a team that is not text', { teamId: 7 }, 'Choose a team.'],
    [
      'a password too short',
      { password: 'short' },
      'Use a password of 12 to 128 characters.',
    ],
    ['a password too long', { password: 'x'.repeat(129) }, 'Use a password'],
    [
      'a password that is not text',
      { password: 123456789012 },
      'Use a password',
    ],
  ])('refuses %s with 400', (_, changes, message) => {
    const body = changes === null ? null : { ...goodBody, ...changes };

    expect(() => readCreateAccount(body)).toThrow(message);
    try {
      readCreateAccount(body);
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
    }
  });
});

describe('readUpdateAccount', () => {
  it('reads the role, the team and whether the account is active', () => {
    expect(
      readUpdateAccount({ role: 'supervisor', teamId: 'atlas', active: false })
    ).toEqual({ role: 'supervisor', teamId: 'atlas', active: false });
  });

  it('reads a missing team as none', () => {
    expect(
      readUpdateAccount({ role: 'admin', active: true }).teamId
    ).toBeNull();
  });

  it.each([
    ['no body', null, 'Choose agent, supervisor or admin.'],
    ['an unknown role', { role: 'owner', active: true }, 'Choose agent'],
    [
      'a team that is not text',
      { role: 'agent', teamId: 7, active: true },
      'Choose a team.',
    ],
    [
      'no active flag',
      { role: 'agent', teamId: 'atlas' },
      'Say whether the account is active.',
    ],
    [
      'an active flag that is not true or false',
      { role: 'agent', teamId: 'atlas', active: 'yes' },
      'Say whether the account is active.',
    ],
  ])('refuses %s with 400', (_, body, message) => {
    expect(() => readUpdateAccount(body)).toThrow(BadRequestException);
    expect(() => readUpdateAccount(body)).toThrow(message);
  });
});

describe('historySince', () => {
  it('starts three calendar months earlier, at the same moment', () => {
    expect(historySince(new Date('2026-10-03T14:30:00.000Z'))).toEqual(
      new Date('2026-07-03T14:30:00.000Z')
    );
  });

  // A day the earlier month lacks is not rolled into the next month, which
  // would make the history days short.
  it.each([
    ['31 May', '2026-05-31T09:00:00.000Z', '2026-02-28T09:00:00.000Z'],
    [
      '31 May in a leap year',
      '2028-05-31T09:00:00.000Z',
      '2028-02-29T09:00:00.000Z',
    ],
    ['31 December', '2026-12-31T09:00:00.000Z', '2026-09-30T09:00:00.000Z'],
    [
      '31 March, across the year',
      '2026-03-31T09:00:00.000Z',
      '2025-12-31T09:00:00.000Z',
    ],
  ])('starts at the end of the earlier month from %s', (_, now, since) => {
    expect(historySince(new Date(now))).toEqual(new Date(since));
  });
});

// Customer requests (#1026): the public form's body, and a supervisor's
// decision on one.
describe('readCustomerRequest', () => {
  const sent = {
    name: 'Dana Whitfield',
    email: 'dana@example.com',
    category: 'billing',
    impact: 'blocked',
    subject: 'Charged twice',
    description: 'My card was charged twice this month.',
    where: 'Invoice INV-2026-10',
    consent: true,
    website: '',
    openedAt: '2026-10-09T12:00:00.000Z',
  };

  it('reads a good body', () => {
    expect(readCustomerRequest(sent)).toEqual(sent);
  });

  it('trims every text, lower-cases the email, and reads an empty where as none', () => {
    expect(
      readCustomerRequest({
        ...sent,
        name: '  Dana Whitfield ',
        email: ' Dana@Example.COM ',
        subject: ' Charged twice ',
        description: '\nMy card was charged twice this month.\n',
        where: '   ',
      })
    ).toEqual({ ...sent, where: null });
  });

  it('reads a missing where and honeypot as none and empty', () => {
    const { where: _, website: __, ...rest } = sent;

    expect(readCustomerRequest(rest)).toEqual({
      ...sent,
      where: null,
      website: '',
    });
  });

  // The honeypot is the API's to judge; a filled one is passed on.
  it('passes on a filled honeypot as it is', () => {
    expect(
      readCustomerRequest({ ...sent, website: 'spam.example' }).website
    ).toBe('spam.example');
  });

  it.each([
    ['no body', null, 'Enter your name'],
    ['no name', { name: '  ' }, 'Enter your name, up to 100 characters.'],
    ['a name too long', { name: 'x'.repeat(101) }, 'Enter your name'],
    [
      'an email that is not one',
      { email: 'dana' },
      'Enter your email address, such as dana@example.com.',
    ],
    ['no category', { category: 'urgent' }, 'Choose what it is about.'],
    ['no impact', { impact: 'very' }, 'Say how much this is affecting you.'],
    ['no subject', { subject: '' }, 'Enter a subject, up to 200 characters.'],
    ['a subject too long', { subject: 'x'.repeat(201) }, 'Enter a subject'],
    [
      'no description',
      { description: ' ' },
      'Describe the problem, up to 10000 characters.',
    ],
    [
      'a description too long',
      { description: 'x'.repeat(10_001) },
      'Describe the problem',
    ],
    [
      'a where too long',
      { where: 'x'.repeat(201) },
      'Keep where it happened to 200 characters or fewer.',
    ],
    ['a where that is not text', { where: 5 }, 'Keep where it happened'],
    [
      'no consent',
      { consent: false },
      'Agree to how your request is kept, to send it.',
    ],
    ['a honeypot that is not text', { website: 1 }, 'Reload the form'],
    ['no time the form opened', { openedAt: 'soon' }, 'Reload the form'],
  ])('refuses %s with 400', (_, changes, message) => {
    const body = changes === null ? null : { ...sent, ...changes };

    expect(() => readCustomerRequest(body)).toThrow(message);
    expect(() => readCustomerRequest(body)).toThrow(BadRequestException);
  });
});

describe('readTurnIntoTicket', () => {
  it('reads the queue and the priority', () => {
    expect(
      readTurnIntoTicket({ queueId: 'billing', priority: 'high' })
    ).toEqual({ queueId: 'billing', priority: 'high' });
  });

  it.each([
    ['no body', null, 'Choose a queue.'],
    ['no queue', { queueId: '', priority: 'high' }, 'Choose a queue.'],
    [
      'an unknown priority',
      { queueId: 'billing', priority: 'asap' },
      'Choose low, normal, high or urgent.',
    ],
  ])('refuses %s with 400', (_, body, message) => {
    expect(() => readTurnIntoTicket(body)).toThrow(message);
    expect(() => readTurnIntoTicket(body)).toThrow(BadRequestException);
  });
});

describe('readDismissal', () => {
  it('reads a reason, with no ticket for anything but a duplicate', () => {
    expect(readDismissal({ reason: 'spam' })).toEqual({
      reason: 'spam',
      duplicateOfTicketNumber: null,
    });
  });

  it('reads a duplicate with the ticket it repeats', () => {
    expect(
      readDismissal({ reason: 'duplicate', duplicateOfTicketNumber: 1002 })
    ).toEqual({ reason: 'duplicate', duplicateOfTicketNumber: 1002 });
  });

  it.each([
    [
      'no reason',
      { reason: 'boring' },
      'Choose spam, already reported, or not a support request.',
    ],
    [
      'a duplicate with no ticket',
      { reason: 'duplicate' },
      'Give the number of the ticket it repeats.',
    ],
    [
      'a duplicate of no real number',
      { reason: 'duplicate', duplicateOfTicketNumber: 1.5 },
      'Give the number of the ticket it repeats.',
    ],
    [
      'a ticket for spam',
      { reason: 'spam', duplicateOfTicketNumber: 1002 },
      'Only a duplicate repeats a ticket.',
    ],
  ])('refuses %s with 400', (_, body, message) => {
    expect(() => readDismissal(body)).toThrow(message);
    expect(() => readDismissal(body)).toThrow(BadRequestException);
  });
});
