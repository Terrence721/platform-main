import { TICKET_MESSAGE_MAX_LENGTH } from '@helpdesk/contract';
import { BadRequestException } from '@nestjs/common';
import {
  historySince,
  readAssigneeId,
  readCreateAccount,
  readMessage,
  readSignIn,
  readStatus,
  readUpdateAccount,
} from './requests';

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
