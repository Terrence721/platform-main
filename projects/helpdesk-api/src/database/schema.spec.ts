import {
  ROLES,
  TICKET_DESCRIPTION_MAX_LENGTH,
  TICKET_MESSAGE_KINDS,
  TICKET_MESSAGE_MAX_LENGTH,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  TICKET_SUBJECT_MAX_LENGTH,
  USER_ID_MAX_LENGTH,
} from '@helpdesk/contract';
import { getTableColumns } from 'drizzle-orm';
import { getTableConfig, PgColumn, PgTable } from 'drizzle-orm/pg-core';
import {
  roleEnum,
  teams,
  ticketMessageKindEnum,
  ticketMessages,
  ticketPriorityEnum,
  tickets,
  ticketStatusEnum,
  users,
} from './schema';

/** A column's maximum length, as the database will enforce it. */
const lengthOf = (column: PgColumn) =>
  (column as PgColumn & { length?: number }).length;

/** Which table a column of `table` points at, by column name. */
const referencesOf = (table: PgTable) =>
  Object.fromEntries(
    getTableConfig(table).foreignKeys.map((key) => {
      const { columns, foreignTable } = key.reference();
      return [columns[0].name, getTableConfig(foreignTable).name];
    })
  );

describe('schema: the values the contract allows', () => {
  it('stores exactly the contract roles', () => {
    expect(roleEnum.enumValues).toEqual(ROLES);
  });

  it('stores exactly the contract ticket statuses, starting at new', () => {
    expect(ticketStatusEnum.enumValues).toEqual(TICKET_STATUSES);
    expect(getTableColumns(tickets).status.default).toBe('new');
  });

  it('stores exactly the contract ticket priorities', () => {
    expect(ticketPriorityEnum.enumValues).toEqual(TICKET_PRIORITIES);
  });

  it('stores exactly the contract message kinds', () => {
    expect(ticketMessageKindEnum.enumValues).toEqual(TICKET_MESSAGE_KINDS);
  });
});

describe('schema: the limits the contract sets', () => {
  it('limits a ticket subject and description as the contract does', () => {
    const { subject, description } = getTableColumns(tickets);

    expect(lengthOf(subject)).toBe(TICKET_SUBJECT_MAX_LENGTH);
    expect(lengthOf(description)).toBe(TICKET_DESCRIPTION_MAX_LENGTH);
  });

  it('limits a message body as the contract does', () => {
    expect(lengthOf(getTableColumns(ticketMessages).body)).toBe(
      TICKET_MESSAGE_MAX_LENGTH
    );
  });

  it('fits every user ID column to the contract user ID', () => {
    expect(lengthOf(getTableColumns(users).id)).toBe(USER_ID_MAX_LENGTH);
    expect(lengthOf(getTableColumns(tickets).assigneeId)).toBe(
      USER_ID_MAX_LENGTH
    );
    expect(lengthOf(getTableColumns(teams).supervisorId)).toBe(
      USER_ID_MAX_LENGTH
    );
    expect(lengthOf(getTableColumns(ticketMessages).authorId)).toBe(
      USER_ID_MAX_LENGTH
    );
  });
});

describe('schema: how the tables connect', () => {
  it('assigns a ticket to a user by sign-in user ID, and may leave it unassigned', () => {
    expect(referencesOf(tickets)).toMatchObject({
      assignee_id: 'users',
      requester_id: 'customers',
      queue_id: 'queues',
    });
    expect(getTableColumns(tickets).assigneeId.notNull).toBe(false);
  });

  it('puts agents and supervisors in a team led by one supervisor; admins in none', () => {
    expect(referencesOf(users)).toEqual({ team_id: 'teams' });
    expect(getTableColumns(users).teamId.notNull).toBe(false);
    expect(referencesOf(teams)).toEqual({ supervisor_id: 'users' });
    expect(getTableColumns(teams).supervisorId.isUnique).toBe(true);
  });

  it('numbers tickets itself, so nobody sets a ticket number by hand', () => {
    const { ticketNumber } = getTableColumns(tickets);

    expect(ticketNumber.generatedIdentity?.type).toBe('always');
    expect(ticketNumber.isUnique).toBe(true);
  });

  it("keeps a conversation with its ticket, and every message's author", () => {
    expect(referencesOf(ticketMessages)).toEqual({
      ticket_id: 'tickets',
      author_id: 'users',
    });
    const onDelete = Object.fromEntries(
      getTableConfig(ticketMessages).foreignKeys.map((key) => [
        key.reference().columns[0].name,
        key.onDelete,
      ])
    );
    expect(onDelete).toEqual({ ticket_id: 'cascade', author_id: 'no action' });
    expect(getTableColumns(ticketMessages).authorId.notNull).toBe(true);
  });
});
