/**
 * The Helpdesk contract: the types, constants and small helpers that the
 * Angular app, the NestJS API and the server library share, imported as
 * `@helpdesk/contract`. It covers tickets (statuses, priorities, the workflow
 * and the API's requests and responses) and their replies and notes, roles,
 * accounts and signing in, teams, reports, live events, and the requests
 * customers send in, with their attachments. Every file in `lib/` is
 * exported from here.
 */
export * from './lib/account';
export * from './lib/attachment';
export * from './lib/auth';
export * from './lib/live-events';
export * from './lib/reports';
export * from './lib/customer-request';
export * from './lib/roles';
export * from './lib/team';
export * from './lib/ticket';
export * from './lib/ticket-api';
export * from './lib/ticket-message';
