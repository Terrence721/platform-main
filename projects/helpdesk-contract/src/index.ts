/**
 * The Helpdesk contract: the types and values the Angular app and the NestJS
 * API share, imported as `@helpdesk/contract`. Each part (ticket statuses and
 * priorities, roles, signing in, then the API's request and response types)
 * is exported from here as it is added.
 */
export * from './lib/auth';
export * from './lib/page';
export * from './lib/roles';
export * from './lib/ticket';
export * from './lib/ticket-api';
