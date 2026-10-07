/**
 * The Helpdesk's server-side logic, imported as `@helpdesk/server`: the
 * database schema (its migrations sit in ../drizzle), the seed, password
 * hashing, the checks every request body passes (`read…`), the services
 * that apply the help desk's rules, and the live-updates hub they tell of
 * each change. The NestJS API (helpdesk-api) wires them to HTTP; the
 * in-browser demo (#942) runs the same checks and services against PGlite.
 */
export * from './lib/auth/password';
export * from './lib/database/database-token';
export * from './lib/database/schema';
export * from './lib/database/seed/generate';
export * from './lib/database/seed/seed';
export * from './lib/database/seed/story';
export * from './lib/live/live-events';
export * from './lib/reports/reports.service';
export * from './lib/requests/requests';
export * from './lib/teams/teams.service';
export * from './lib/tickets/ticket-dto';
export * from './lib/tickets/ticket-messages.service';
export * from './lib/tickets/tickets.service';
export * from './lib/users/users.service';
