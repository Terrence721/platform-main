import {
  ACCOUNT_NAME_MAX_LENGTH,
  type AddTicketMessageRequest,
  type CreateAccountRequest,
  isRole,
  isTicketMessageKind,
  isTicketStatus,
  isUserId,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  TICKET_MESSAGE_MAX_LENGTH,
  type TicketStatus,
} from '@helpdesk/contract';
import { BadRequestException } from '@nestjs/common';

// How the API reads a request: each body or value checked before it reaches
// a service, with a 400 that says what is expected. The NestJS controllers
// use these, and so does the in-browser demo (#942), so both refuse the
// same requests with the same words.

/**
 * The fields of a sign-in body, as strings; anything else becomes an empty
 * string, which then fails like a wrong password (same answer, same time).
 */
export function readSignIn(body: unknown): {
  userId: string;
  password: string;
} {
  const fields = (typeof body === 'object' && body !== null ? body : {}) as {
    userId?: unknown;
    password?: unknown;
  };
  return {
    userId: typeof fields.userId === 'string' ? fields.userId : '',
    password: typeof fields.password === 'string' ? fields.password : '',
  };
}

/** The agent an Assign body names; anything else is refused with 400. */
export function readAssigneeId(body: unknown): string {
  const assigneeId =
    typeof body === 'object' && body !== null
      ? (body as { assigneeId?: unknown }).assigneeId
      : undefined;
  if (!isUserId(assigneeId)) {
    throw new BadRequestException('Choose an agent to assign the ticket to.');
  }
  return assigneeId;
}

/** The status a Change status body names; anything else is refused with 400. */
export function readStatus(body: unknown): TicketStatus {
  const status =
    typeof body === 'object' && body !== null
      ? (body as { status?: unknown }).status
      : undefined;
  if (!isTicketStatus(status)) {
    throw new BadRequestException(
      'Choose new, open, pending, resolved or closed.'
    );
  }
  return status;
}

/**
 * The reply or note a message body holds, its text trimmed; a missing
 * kind, or text that is empty or too long, is refused with 400.
 */
export function readMessage(body: unknown): AddTicketMessageRequest {
  const { kind, body: text } =
    typeof body === 'object' && body !== null
      ? (body as { kind?: unknown; body?: unknown })
      : {};
  if (!isTicketMessageKind(kind)) {
    throw new BadRequestException('Choose reply or note.');
  }
  const trimmed = typeof text === 'string' ? text.trim() : '';
  if (trimmed === '') {
    throw new BadRequestException('Write a message first.');
  }
  if (trimmed.length > TICKET_MESSAGE_MAX_LENGTH) {
    throw new BadRequestException(
      `Keep the message to ${TICKET_MESSAGE_MAX_LENGTH} characters or fewer.`
    );
  }
  return { kind, body: trimmed };
}

/**
 * The fields of a Create Account body, checked one by one; the first that
 * is wrong is refused with 400 and says what is expected. The name is
 * trimmed. Team rules (whether this role needs a team) are the service's.
 */
export function readCreateAccount(body: unknown): CreateAccountRequest {
  const fields = (typeof body === 'object' && body !== null ? body : {}) as {
    userId?: unknown;
    name?: unknown;
    role?: unknown;
    teamId?: unknown;
    password?: unknown;
  };
  if (!isUserId(fields.userId)) {
    throw new BadRequestException(
      'Use a user ID of 3 to 32 lowercase letters, digits, dots and hyphens, starting with a letter.'
    );
  }
  const name = typeof fields.name === 'string' ? fields.name.trim() : '';
  if (name.length === 0 || name.length > ACCOUNT_NAME_MAX_LENGTH) {
    throw new BadRequestException(
      `Enter a name of 1 to ${ACCOUNT_NAME_MAX_LENGTH} characters.`
    );
  }
  if (!isRole(fields.role)) {
    throw new BadRequestException('Choose agent, supervisor or admin.');
  }
  const teamId = fields.teamId ?? null;
  if (teamId !== null && typeof teamId !== 'string') {
    throw new BadRequestException('Choose a team.');
  }
  const password = fields.password;
  if (
    typeof password !== 'string' ||
    password.length < PASSWORD_MIN_LENGTH ||
    password.length > PASSWORD_MAX_LENGTH
  ) {
    throw new BadRequestException(
      `Use a password of ${PASSWORD_MIN_LENGTH} to ${PASSWORD_MAX_LENGTH} characters.`
    );
  }
  return { userId: fields.userId, name, role: fields.role, teamId, password };
}

/** How far back a team member's history goes. */
export const HISTORY_MONTHS = 3;

/** The start of a history ending `now`: the same moment, months earlier. */
export function historySince(now: Date): Date {
  const since = new Date(now);
  since.setUTCMonth(since.getUTCMonth() - HISTORY_MONTHS);
  return since;
}
