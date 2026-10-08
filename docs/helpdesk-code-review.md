# Helpdesk Code Review Results

<!-- markdownlint-disable-next-line MD036 -->

**Last Updated: October 8, 2026** (`helpdesk-contract` complete: 11 of 11; `helpdesk-server` complete: 23 of 23; `helpdesk-api` complete: 24 of 24; `helpdesk` in progress: 3 of 63)

> [!CAUTION]
> This is a simulation of real-world code review.

The Helpdesk app ([#303](https://github.com/Terrence721/platform-main/issues/303)) was built through one issue and pull request per feature, with tests and review on every one, but its finished files had never been audited one by one for defects. This audit does that, the same way the 13 modules were audited ([#32](https://github.com/Terrence721/platform-main/issues/32), findings in [`code-review.md`](code-review.md)). Its tracking issue is [#1001](https://github.com/Terrence721/platform-main/issues/1001), with one sub-issue per project.

**Scope: 123 files.** Every non-spec source file of the five Helpdesk projects, plus the files with real logic outside TypeScript: the SQL migrations, both `Dockerfile`s and the app's `nginx.conf`. It began at 121; the fixes for [#1020](https://github.com/Terrence721/platform-main/issues/1020) and [#1049](https://github.com/Terrence721/platform-main/issues/1049) each added a migration, so `helpdesk-server` has 23. Specs, ESLint configs, styles and tool configs are out of scope, as in #32.

| Order | Project             | Files | Tracking issue                                                    |
| ----- | ------------------- | ----- | ----------------------------------------------------------------- |
| 1     | `helpdesk-contract` | 11    | [#1002](https://github.com/Terrence721/platform-main/issues/1002) |
| 2     | `helpdesk-server`   | 23    | [#1003](https://github.com/Terrence721/platform-main/issues/1003) |
| 3     | `helpdesk-api`      | 24    | [#1004](https://github.com/Terrence721/platform-main/issues/1004) |
| 4     | `helpdesk`          | 63    | [#1005](https://github.com/Terrence721/platform-main/issues/1005) |
| 5     | `helpdesk-e2e`      | 2     | [#1006](https://github.com/Terrence721/platform-main/issues/1006) |

The order is bottom-up through the [project dependency graph](https://terrence721.github.io/platform-main/diagrams/project-dependency-graph.html), so each file's review can rely on what's beneath it already being reviewed.

**Process:** one file at a time. Each file gets a row in [todo.md](../todo.md)'s per-file table for its project (path and the commit that last touched it), a sub-issue of its project's issue with the findings (written even when there are none), and its own pull request, merged by the repo owner before the next file starts. A bug fix comes with a test that fails without it.

## Findings

### [`helpdesk-contract/src/index.ts`](https://github.com/Terrence721/platform-main/blob/6f52d530af96546b33600b42dc485116d1d4e0d2/projects/helpdesk-contract/src/index.ts)

**Low · Maintainability** — 1 stale doc comment fixed ([issue #1007](https://github.com/Terrence721/platform-main/issues/1007))

The barrel for `@helpdesk/contract`: one `export *` per file in `src/lib`. Checked with the TypeScript compiler rather than by eye. All 10 lib files are exported; between them they export 92 names, and the barrel exports exactly 92, so no `export *` collision silently drops a name. No exported declaration uses a type its file keeps private, so every type a public signature needs is reachable through the package (the barrel-gap class #32 found 13 times in `schematics-core`). The one defect was the doc comment: it still described the contract as growing ("exported from here as it is added") and listed only tickets, roles, signing in and the API's types, missing accounts, ticket messages, teams, reports, live events and paging. Rewritten to describe what the contract holds today; no behavior change.

Noted for later files rather than changed here: 7 exported names are used nowhere outside their own project (`normalizePageRequest`, `pageCount`, `isTicketSort`, `DEFAULT_TICKET_SORT`, `TicketListQuery`, `CreateTicketRequest`, `UpdateTicketRequest`). They look like planned paging, sorting and ticket-editing features that were never built, and are left to the reviews of `page.ts` and `ticket-api.ts`. Another 15 are used only by other contract types (for example `TicketChangedEvent`, part of the live-event union), which is expected.

---

### [`helpdesk-contract/src/lib/account.ts`](https://github.com/Terrence721/platform-main/blob/a57da936448e63ae2c401ab5de2efbbf0fa5c80a/projects/helpdesk-contract/src/lib/account.ts)

**Medium · Correctness** — 1 bug found and fixed separately ([#1009](https://github.com/Terrence721/platform-main/issues/1009), [PR #1012](https://github.com/Terrence721/platform-main/pull/1012)), 2 doc comments fixed ([issue #1010](https://github.com/Terrence721/platform-main/issues/1010))

The account types and constants. Every doc comment here promises server behavior, so each promise was traced to the code behind it rather than read on trust: the password hash never leaves the database (`selectAccounts` reads six columns only); a new account's user ID, name, password and team are checked as described, the name by both the Create popup and the API; your own account and the last active admin are protected.

The bug: changing an account hands its open tickets back only when it is "deactivated, moved to another team, or made an admin", and an agent made a supervisor of the same team is none of those. Supervisors don't work tickets, My team lists only agents, and reassigning accepts only tickets an agent holds, so the agent's open tickets are stranded. Reproduced against PGlite with the real migrations: after the change the ticket was still Sam's, in neither My team nor Unassigned, and both his old lead and Sam himself were refused when reassigning it ("No such ticket on your team."). The rule lives in the server, the edit popup's warning and this file, so the fix has its own issue and pull request ([#1009](https://github.com/Terrence721/platform-main/issues/1009)), as cross-file bugs did in #32.

Fixed here: released tickets go to the one shared Unassigned list every team works from, not "the team's" (two comments); and who becomes a team's lead needed two conditions it left out, that the account is active and that a supervisor moved to another team also becomes its lead.

---

### [`helpdesk-contract/src/lib/auth.ts`](https://github.com/Terrence721/platform-main/blob/31a55b340604e165e342e9b058d6646e559e59e9/projects/helpdesk-contract/src/lib/auth.ts)

**Low · Maintainability** — 1 missing doc comment added ([issue #1013](https://github.com/Terrence721/platform-main/issues/1013))

The sign-in contract. Its comments make security promises, and each was checked against the API rather than taken on trust. Every failed sign-in looks the same from outside: an unknown or malformed user ID still checks the password against a dummy hash, so it takes as long as a wrong one, and an inactive account checks the password before failing, all answered with one 401 and one message. An over-long password fails before any lookup, so its timing depends only on what was typed. The session lives in an httpOnly, SameSite=Strict cookie limited to `/api` (Secure in production) and never in a response body; the token and the cookie both last `SESSION_HOURS`; and `/me` reads the account from the database each time, so a deactivation takes effect at once. The password minimum is checked when a password is set and the maximum everywhere, as the comment says.

The one defect: `USER_ID_MAX_LENGTH` was the only export without a doc comment, though it must equal the longest ID `USER_ID_PATTERN` allows (`auth.spec.ts` checks 32 is allowed and 33 refused) and sets the width of four database columns. A comment now says both.

### [`helpdesk-contract/src/lib/live-events.ts`](https://github.com/Terrence721/platform-main/blob/6f52d530af96546b33600b42dc485116d1d4e0d2/projects/helpdesk-contract/src/lib/live-events.ts)

**Low · Test coverage** — 1 missing spec added ([issue #1015](https://github.com/Terrence721/platform-main/issues/1015))

The live-updates contract: the stream's URL, its three events and `isLiveEvent`, which the app uses to drop anything on the stream it does not know. Each comment was checked against the code. The URL matches the API's `api` prefix and its `events` controller. Ticket events come from `TicketsService` (assigned, taken, status changed) and from `UsersService` (tickets an account edit hands back), message events from `TicketMessagesService`, and accounts events from creating or changing an account. No event carries more than a type and a ticket ID, so no ticket data travels on the stream, as the comment promises.

The one gap: `isLiveEvent` was the only checking function in the contract without a spec of its own, tested only through the app's `live-updates.spec.ts`, which never tried a `message` event, `null`, a non-object, or a ticket ID that is not a string. A new `live-events.spec.ts` covers all three events and 11 malformed values, and checks that the function narrows the type. The function was already correct.

### [`helpdesk-contract/src/lib/page.ts`](https://github.com/Terrence721/platform-main/blob/1c1b34b4e3d2d952773e27048ace93eace281106/projects/helpdesk-contract/src/lib/page.ts)

**Low · Dead code** — the file removed, with the one type that used it ([issue #1017](https://github.com/Terrence721/platform-main/issues/1017))

Paging shapes and helpers: `PageRequest`, `Page<T>`, the page-size defaults, `normalizePageRequest` and `pageCount`. The commit that added them (#868) meant `Page<T>` for every list endpoint, but no endpoint pages: every ticket list returns a plain array and the app has no paginator. The code was correct and tested, but it suggested the API pages its lists when it does not, and the `index.ts` comment listed "paging" among what the contract covers. Lists without paging are fine at this scale (a team's open work, the calm seed's Unassigned list), so building paging was not needed.

The first check for users looked only at the other projects and missed one inside the contract: `TicketListQuery` in `ticket-api.ts` extended `PageRequest`. It was unused too, describing a filtered, sorted, paged list query that was never built. So this change removes `page.ts`, its spec, `TicketListQuery` and its one test, and drops the export and the word "paging" from `index.ts`. The rest of `ticket-api.ts` is left for its own review. Git history keeps the code if paging is ever built.

### [`helpdesk-contract/src/lib/reports.ts`](https://github.com/Terrence721/platform-main/blob/27cb6afcff516238b75b5e7c2c0ddc672e174d8c/projects/helpdesk-contract/src/lib/reports.ts)

**Medium · Correctness** — 1 bug fixed ([#1020](https://github.com/Terrence721/platform-main/issues/1020)); **Low** — 1 doc comment fixed, 1 constant renamed ([issue #1019](https://github.com/Terrence721/platform-main/issues/1019))

The Reports popup's contract. Each comment was checked against `ReportsService`, the reporting views, the controller and the app. The 30-day window, the open work by priority and status, overdue, SLA met (only finished tickets with a due time), the first customer reply (notes don't count), who may see which team or agent (another supervisor's is 404), the choices and the query parameters all hold.

The bug: nothing records when a ticket was finished, so the reporting view and the history popup's on-time / late split use its last change, as the comment admits. But closing a resolved ticket, or replying to one, is a change. A ticket resolved before its due time and closed the next day counts as late, and its time to resolve grows. It needs a real finish time on tickets and a migration, so it was filed as #1020 and fixed in its own PR, as #1009 was ([#1022](https://github.com/Terrence721/platform-main/pull/1022)): tickets now record when they were finished (set as they leave open work, kept when a resolved ticket is closed, cleared on reopening), and the reports, the history popup and the Done list read that instead.

Two smaller fixes here. `ReportsResponse.agents` said "the team's agents", but only active agents get a row; it now says so. And the open-work statuses (new, open, pending) were written out five times across the projects, with the contract's copy named for reports (`OPEN_REPORT_STATUSES`). It is now the general `OPEN_WORK_STATUSES` (and `OpenWorkStatus`), with its one user updated; the server's, the supervisor page's, the seed's and the reports query's copies switch to it in their own files' reviews.

### [`helpdesk-contract/src/lib/roles.ts`](https://github.com/Terrence721/platform-main/blob/93a8e186eb3793cc6ac2c0d6b0c733face186bc8/projects/helpdesk-contract/src/lib/roles.ts)

**Medium · Correctness** — the permission table corrected to what the API allows ([issue #1023](https://github.com/Terrence721/platform-main/issues/1023)); 1 related issue filed ([#1024](https://github.com/Terrence721/platform-main/issues/1024))

The roles, the permissions and which role has which. `ROLE_PERMISSIONS` enforces nothing: the API checks roles with `@OnlyFor(...)` on each route, and the table's one user is the public landing page's "Three roles, clear limits". So the landing page showed the original plan, and 5 of its 15 ticks were false. It said admins work tickets (no ticket route admits them), that supervisors and admins take tickets (only agents can; a supervisor assigns only to an agent on their team), and that admins manage queues, customers and canned replies, which were never built. Its "change status and priority" named a priority change that does not exist either. `roles.spec.ts` passed because it checked the same planned table.

The contract now matches the routes: agents read, reply, update and take; supervisors read, reply, update and assign others; admins manage accounts. The three permissions for features never built are gone. The spec's table is written out from the routes, with tests that only agents take and only supervisors assign, and that admins have no ticket work. The landing table follows: four rows and 12 ticks, the queues row removed and "change status and priority" now "change status". The API keeps its `@OnlyFor` guards; the contract describes them rather than enforcing anything.

The landing page's feature cards and hero make similar claims (email intake, filters and search, canned replies, queue management). They are filed as #1024, to fix in the reviews of `capability.ts` and `landing.page.ts`.

### [`helpdesk-contract/src/lib/team.ts`](https://github.com/Terrence721/platform-main/blob/5a9b084/projects/helpdesk-contract/src/lib/team.ts)

**Low-medium · Correctness** — 1 bug fixed ([#1027](https://github.com/Terrence721/platform-main/issues/1027)); **Low** — 1 doc comment fixed ([issue #1028](https://github.com/Terrence721/platform-main/issues/1028))

The supervisor's My team overview and an agent's history summary, checked against `TeamsService`, the history endpoint and the supervisor page. The members' open and overdue counts, the unassigned list (every open ticket nobody holds, most urgent first), the history window and its order, and on time / late (by when a ticket was finished, since #1022) all hold.

The bug: `members` lists every agent on the team, deactivated ones included, since a deactivated agent keeps their team. The supervisor's Assign popup offers them all, but assigning accepts only an active agent, so picking a former colleague ends in "No such agent on your team." `TeamMember` has no `active` field, so the app could not filter them either. The chosen fix lists only active agents, as the Reports popup's choices already do; it changed the server and the contract, so it was filed as #1027 and fixed in its own PR ([#1030](https://github.com/Terrence721/platform-main/pull/1030)): My team, and so the Assign popup, now lists only active agents.

The doc fix: in `HistorySummary`, `finished` and `open` both began "Of those", so read in order `open` seemed to count among the finished tickets. Both now say "Of `assigned`".

### [`helpdesk-contract/src/lib/ticket-api.ts`](https://github.com/Terrence721/platform-main/blob/a083a80/projects/helpdesk-contract/src/lib/ticket-api.ts)

**Low · Dead code, documentation** — 9 unused names removed, 2 doc comments fixed ([issue #1031](https://github.com/Terrence721/platform-main/issues/1031))

The ticket as the API sends it, the request bodies, the limits and the ticket number's format. This time every export's users were listed across all five projects, the contract included. `TicketDto` and its summaries match what the server builds, `ChangeStatusRequest` and the Done list's 24 hours hold, and `formatTicketNumber` serves six screens.

Nine names served nothing. The five sorting names (`TICKET_SORT_FIELDS`, `TicketSortField`, `TicketSort`, `DEFAULT_TICKET_SORT`, `isTicketSort`) belonged to the list query removed with `page.ts`; no list takes a sort. `CreateTicketRequest` described a route that does not exist (the customer reports of #1026 will need shapes of their own), and `UpdateTicketRequest` promised one route that changes any field, checked by `hasPermission`, when assigning and status have routes of their own and priority, queue and tags cannot change. The tag limits `TICKET_MAX_TAGS` and `TICKET_TAG_MAX_LENGTH` limited nothing: the `tags` column has none, and their only user was a landing spec checking the sample tickets against them, so those two checks went too. All nine are removed with their tests.

Two comments were fixed. The limits were said to be enforced by "the app's forms and the API's validation", but nothing writes a ticket; the subject and description limits are the widths of their columns, and the comment now says so. `AssignTicketRequest` described only supervisors, though the same route is how an agent takes an unassigned ticket, by naming themselves; it now says both.

### [`helpdesk-contract/src/lib/ticket-message.ts`](https://github.com/Terrence721/platform-main/blob/d5edab9/projects/helpdesk-contract/src/lib/ticket-message.ts)

**Low · Documentation** — 2 doc comments completed ([issue #1033](https://github.com/Terrence721/platform-main/issues/1033))

Replies and internal notes. Every export is used, and every claim holds: a reply stays on the ticket and no email is sent, a note is for staff, the customer's first message is the description and is not repeated, and only the holder or their team's supervisor may write. The form and the API both trim the text, refuse it empty and refuse it over 5,000 characters.

Two comments said less than the code does. `AddTicketMessageRequest` did not say that a closed ticket refuses messages while a resolved one still takes them, nor that the body is trimmed and must not be empty; it now does. And `TICKET_MESSAGE_MAX_LENGTH` also sets the width of the column that holds a message, as `USER_ID_MAX_LENGTH` does for user IDs, so its comment now says the two change together.

### [`helpdesk-contract/src/lib/ticket.ts`](https://github.com/Terrence721/platform-main/blob/ff19b57/projects/helpdesk-contract/src/lib/ticket.ts)

**Low · Dead code** — 1 unused guard removed ([issue #1035](https://github.com/Terrence721/platform-main/issues/1035))

The statuses, priorities and the workflow table. Every claim holds: the statuses are in workflow order and the priorities lowest first; a resolved ticket can be reopened and a closed one is final, which the server enforces ("A closed ticket can't change."); and no status lists itself, so a move to the same status is refused. The table drives both the ticket table's status menu and the landing page's "How a ticket moves", and `canTransition` is the server's check.

`isTicketPriority` had no source users: priorities cannot be changed, so nothing reads one from a request. Its only users were its own test and a landing spec checking the sample tickets' priorities, which TypeScript already types. As with the tag limits in `ticket-api.ts`, it is removed with both checks; the customer reports of #1026 can add a guard when a supervisor picks a priority.

### [`helpdesk-server/src/index.ts`](https://github.com/Terrence721/platform-main/blob/6f52d53/projects/helpdesk-server/src/index.ts)

**Low · Documentation** — 1 doc comment completed ([issue #1037](https://github.com/Terrence721/platform-main/issues/1037))

The first file of `helpdesk-server`, whose review starts after the contract's (11 files, complete; the summary is on [#1002](https://github.com/Terrence721/platform-main/issues/1002)). The entry point re-exports 14 modules; the three it leaves out are internal (the reporting views, read only by the reports service, the ticket access check and the live-event audiences). Its comment held, but named only four of the library's parts: the schema, the seed, password hashing and the services. It left out the request checkers, where every request body is checked (the API and the in-browser demo both call them, which is why they live here), and the live-updates hub the services tell of each change. It now names all six.

### [`helpdesk-server/src/lib/auth/password.ts`](https://github.com/Terrence721/platform-main/blob/b5da27a/projects/helpdesk-server/src/lib/auth/password.ts)

**Medium · Security** — 1 weakness fixed ([#1039](https://github.com/Terrence721/platform-main/issues/1039)) ([issue #1040](https://github.com/Terrence721/platform-main/issues/1040))

Password hashing and checking with Node's built-in scrypt. The mechanics are sound: a fresh 16-byte salt per hash, a constant-time comparison with the lengths checked first, no exception on a damaged hash, and over-long passwords refused before any hashing (the 128-character maximum, from `auth.ts`), so a huge password cannot slow the server down. Sign-in checks unknown users against a dummy hash, so they take as long as known ones. The in-browser demo's quick stand-in is deliberate and documented.

The weakness is the cost. scrypt runs with Node's defaults, N = 2¹⁴, where OWASP's Password Storage guidance asks for at least N = 2¹⁷: measured here, 59 ms a hash against 551 ms. That cost is what makes a stolen database expensive to crack. And the stored form, `scrypt$<salt>$<key>`, does not record the cost, so raising it would quietly break every existing hash despite the comment's "a stronger one can be added later". The fix raises the cost, makes the stored form carry its settings, and has the seed hash its one shared password once so start-up stays quick. It touched the seed, the in-browser demo's stand-in for scrypt and the specs as well, so it was filed as #1039 and fixed in its own PR ([#1042](https://github.com/Terrence721/platform-main/pull/1042)): new passwords are hashed at N = 2¹⁷ and stored as `scrypt$N=131072,r=8,p=1$<salt>$<key>`, `verifyPassword` reads the cost back and refuses any it would not run, and the seed hashes its one published password once for all 48 accounts.

### [`helpdesk-server/src/lib/database/database-token.ts`](https://github.com/Terrence721/platform-main/blob/b5da27a/projects/helpdesk-server/src/lib/database/database-token.ts)

**Low · Type safety** — 1 finding fixed ([#1043](https://github.com/Terrence721/platform-main/issues/1043)) ([issue #1044](https://github.com/Terrence721/platform-main/issues/1044))

The injection token and type the services take their database by. Its comment holds: the two are kept apart from the API's `DatabaseModule` so that the in-browser demo never loads `pg` or the Node driver, and the driver import is type-only, so nothing of it is left after compiling.

The type names one driver, though. `Database` is node-postgres's `NodePgDatabase`, while the in-browser demo and 14 specs run the same services on PGlite, so each passes its client as `as unknown as Database`, most beside a copied comment saying both are Drizzle's Postgres databases with the same query builder. That is true, and Drizzle has a type for it, `PgDatabase<PgQueryResultHKT>`, which both clients extend. A double cast turns type checking off at exactly the seam between the two drivers: a service relying on something only node-postgres offers would break the demo at run time without a compiler warning. Typing `Database` as the shared base removed the 13 PGlite casts (two more cast hand-made fake databases, where a cast is the right tool). It touched the demo and the specs, so it was filed as #1043 and fixed in its own PR ([#1046](https://github.com/Terrence721/platform-main/pull/1046)). The change also surfaced a hidden dependency: `password.ts` uses Node's `crypto` and `Buffer`, and the app's build (which type-checks the server code for the demo) found them only because the old type pulled in Node's types as a side effect. `password.ts` now declares them itself.

### [`helpdesk-server/src/lib/database/schema.ts`](https://github.com/Terrence721/platform-main/blob/5a9b084/projects/helpdesk-server/src/lib/database/schema.ts)

**Low · Documentation** — 3 doc comments fixed ([issue #1047](https://github.com/Terrence721/platform-main/issues/1047))

The tables, enums and indexes, checked against the migrations, the services and the contract. The structure holds: values and limits come from the contract; users and teams refer to each other, one team per supervisor; the user ID is the key, so an assignee is the sign-in ID; ticket numbers start at 1001 and are never reused; messages go with their ticket while their authors are kept, as accounts are deactivated rather than deleted.

Three comments were wrong or missing. The indexes were said to serve "the contract's list filters and sorts", a list query removed in #1018 and #1032; the comment now names what the services filter and sort by, and admits that the queue index serves no query yet (it stays, as dropping it would take a migration). `updatedAt` was said to move on every update, but it is Drizzle's `$onUpdate`, not a database trigger, so raw SQL such as migration `0003`'s backfill leaves it alone. And `tickets`, the central table, was the only one without a doc comment.

Considered and left for later: CHECK constraints for rules only the services enforce (admins have no team, a team's supervisor has that role, `finishedAt` is set exactly when a ticket is finished). They would add defense in depth, but each needs a migration, and the services and their tests enforce them today.

### [`helpdesk-server/src/lib/database/reporting.ts`](https://github.com/Terrence721/platform-main/blob/5a9b084/projects/helpdesk-server/src/lib/database/reporting.ts)

**Low · Dead code** — 1 finding fixed ([#1049](https://github.com/Terrence721/platform-main/issues/1049)) ([issue #1050](https://github.com/Terrence721/platform-main/issues/1050))

The `reporting` schema: read-only views over the tables, which the Reports popup's service reads instead of the tables themselves. Its privacy promise holds (no password hashes, no message text, no customers), statuses and the like are plain text, times keep their time zone, and since #1022 a ticket's `finished_at` is when it was really finished.

The header says the schema holds "only what the reports need", but two of its five views serve nothing. The schema was first built for a Power BI report (#966); Power BI was dropped (#965), and the Reports popup then read only the teams, users and tickets views. The queues and messages views stayed, in the code and in the database, read only by their own spec. Removing them took a migration, so it was filed as #1049 and fixed in its own PR ([#1052](https://github.com/Terrence721/platform-main/pull/1052)): both views are gone from the code, migration `0004` drops them from the database, and the spec now also checks that each ticket's finish time is the table's, not its last change, a leftover from before #1022.

### [`helpdesk-server/drizzle/0000_init.sql`](https://github.com/Terrence721/platform-main/blob/b5da27a/projects/helpdesk-server/drizzle/0000_init.sql)

**No defect** — 1 process gap closed ([#1053](https://github.com/Terrence721/platform-main/issues/1053)) ([issue #1054](https://github.com/Terrence721/platform-main/issues/1054))

The first migration, generated by drizzle-kit. It does what the schema says: the contract's enums, its limits as column widths, ticket numbers as an identity from 1001, the foreign keys with their delete rules, and the indexes; `gen_random_uuid()` runs on PostgreSQL 18 and on PGlite. With the later migrations it equals today's schema, as `yarn db:generate` confirms. Being applied history, it is never edited: a mistake would be fixed by a new migration.

The gap is around it. Nothing stops the schema and the migrations drifting apart: a forgotten `yarn db:generate` after a new column fails the specs, but after a changed index, constraint or default it passes everything, and every database differs from the code. CI already failed when the build left the tree changed, so generating there catches it: filed as #1053 and closed in [#1056](https://github.com/Terrence721/platform-main/pull/1056), proven on a scratch copy where a new index without its migration made the step write `0005` and fail. And a note for the customer reports of #1026: `customers.email` is unique as typed, so the same address in different case would make two customers, which matters once reports create customers.

### [`helpdesk-server/drizzle/0001_ticket_messages.sql`](https://github.com/Terrence721/platform-main/blob/b5da27a/projects/helpdesk-server/drizzle/0001_ticket_messages.sql)

**No findings** ([issue #1057](https://github.com/Terrence721/platform-main/issues/1057))

The migration that added replies and internal notes, generated by drizzle-kit. It matches the schema and the services: the message kinds are the contract's, the body column is as wide as the contract's message limit (the two change together), a ticket's messages go with it while an author can never be deleted from under them, and its one index, by ticket and time, is exactly what showing a ticket's conversation oldest first needs. Drift from the schema is now caught by CI (#1053).

### [`helpdesk-server/drizzle/0002_reporting_views.sql`](https://github.com/Terrence721/platform-main/blob/1d9b93b/projects/helpdesk-server/drizzle/0002_reporting_views.sql)

**No findings** ([issue #1059](https://github.com/Terrence721/platform-main/issues/1059))

The migration that created the `reporting` schema and its five views. Two of its parts were wrong, and both were found by this audit and fixed the right way for applied history, by later migrations: the tickets view timed a finished ticket by its last change (#1020, rebuilt by `0003`), and the queues and messages views, made for the dropped Power BI report, served nothing (#1049, dropped by `0004`). The teams and users views stand as written.

One note: the views share the app's database login, with no read-only role or grants, so the schema narrows what the reports read rather than restricting who can read the tables. The schema's header claims no more than that; a locked-down role would only matter if an outside reporting tool were given a login of its own.

### [`helpdesk-server/drizzle/0003_ticket_finished_at.sql`](https://github.com/Terrence721/platform-main/blob/5a9b084/projects/helpdesk-server/drizzle/0003_ticket_finished_at.sql)

**No findings** ([issue #1061](https://github.com/Terrence721/platform-main/issues/1061))

The migration written for #1020 earlier in this audit, so reviewed by its author and checked step by step. It drops the tickets view (nothing depends on it), adds `finished_at` as a nullable column with no default (a metadata-only change in PostgreSQL, with no table rewrite), backfills finished tickets from their last change by hand (the best record there is, and without moving `updated_at`), and recreates the view to read the new column, in that order. The in-browser demo runs it statement by statement, comment lines included, as its spec and every spec on the real migrations show; and its generated parts match the schema, which CI now enforces (#1053).

### [`helpdesk-server/drizzle/0004_drop_unused_reporting_views.sql`](https://github.com/Terrence721/platform-main/blob/00d5bbb/projects/helpdesk-server/drizzle/0004_drop_unused_reporting_views.sql)

**No findings** ([issue #1063](https://github.com/Terrence721/platform-main/issues/1063))

The last of the five migrations, written for #1049 earlier in this audit: two generated statements dropping the reporting views nothing read. Nothing depends on either view, the plain `DROP VIEW` (without `IF EXISTS`) is right for a migration that runs once and in order, the in-browser demo applies it, and it matches the schema. With it, every migration has been reviewed: two of them (`0003`, `0004`) exist because of this audit, and the others needed no change.

### [`helpdesk-server/src/lib/database/seed/generate.ts`](https://github.com/Terrence721/platform-main/blob/b80778e/projects/helpdesk-server/src/lib/database/seed/generate.ts)

**Medium · Correctness** — 1 bug fixed ([#1065](https://github.com/Terrence721/platform-main/issues/1065)); **Low** — 1 duplicate removed ([issue #1066](https://github.com/Terrence721/platform-main/issues/1066))

The generated part of the seed: the rest of the agents, the customers and the ticket volume around the hand-written story. Much of it holds: Faker runs on a fixed seed, customers use only the domains reserved for examples, user IDs are always valid and unique, open work is mostly on time and finished work mostly finished within its SLA, and every message falls between its ticket's creation and last change.

The bug: 5% of assigned tickets go to a supervisor, though supervisors do not work tickets (#1009). With the default seed that is 42 tickets. Three are open work nobody can reach, exactly the stuck tickets of #1009: not on My team, impossible to reassign, and supervisors have no My tickets page. The other 39 count in their team's row of the Reports popup but in no agent's, so a team's totals do not add up to its agents'. The fix changed which tickets the seed generates, so it was filed as #1065 and fixed in its own PR ([#1068](https://github.com/Terrence721/platform-main/pull/1068)): generated tickets go only to agents, with a test that failed on all 42; the seed's statistics tests and the end-to-end suite, run on the real stack, pass on the new data.

Also here: the local `OPEN_WORK` list repeated the contract's `OPEN_WORK_STATUSES`, one of the copies the `reports.ts` review left to switch; it now uses the contract's. And a note: `userIdFor` would loop forever on a name that cleans to nothing, which Faker's English names never do, so it is left as it is.

### [`helpdesk-server/src/lib/database/seed/story.ts`](https://github.com/Terrence721/platform-main/blob/b5da27a/projects/helpdesk-server/src/lib/database/seed/story.ts)

**Low · Maintainability, documentation** — 1 spec added, 1 doc comment ([issue #1069](https://github.com/Terrence721/platform-main/issues/1069))

The hand-written part of the seed: the queues, the teams and their supervisors, the named users, and the four showcase tickets the landing page previews. It holds: every showcase ticket goes to Sam, an agent; every message falls within its ticket's life; the one supervisor note is by Sam's own team lead; and the only real names, the four customers, are a tribute to computing pioneers on example addresses.

The showcase lives twice, here and in the app's landing page, which shows it without an API. The copies agreed, but editing one would have failed no test, and the live demo would then show a preview that differs from Sam's seeded My tickets. A spec in the app now compares the two field by field. And the showcase's due times do not follow the SLA rules the generated tickets do (Ada's urgent ticket would already be an hour overdue); they are chosen to show each state on the preview, which the comment now says.

### [`helpdesk-server/src/lib/database/seed/seed.ts`](https://github.com/Terrence721/platform-main/blob/8d989b9/projects/helpdesk-server/src/lib/database/seed/seed.ts)

**No findings** ([issue #1071](https://github.com/Terrence721/platform-main/issues/1071))

Writes the seed into an empty database. It does what it says: everything goes in one transaction, so a failure keeps nothing, and the one slow step, hashing the shared password, comes before it. It refuses a database that already has users; two seeds started at once could both pass that check, but the second would then fail on the users' keys and roll back, so nothing mixes either way. Teams, users and each team's supervisor go in the only order their foreign keys allow; inserts stay well under PostgreSQL's parameter limit; and messages are matched to their tickets by ticket number, which a spec proves on a real database. The summary it returns holds counts and example user IDs, never the password. With it, the seed's three files are reviewed: two bugs fixed (#1020's finish times, #1065's supervisor-held tickets) and the showcase's two copies now tied by a test.

### [`helpdesk-server/src/lib/live/live-events.ts`](https://github.com/Terrence721/platform-main/blob/6f52d53/projects/helpdesk-server/src/lib/live/live-events.ts)

**Low · Security** — 1 finding fixed ([#1073](https://github.com/Terrence721/platform-main/issues/1073)) ([issue #1074](https://github.com/Terrence721/platform-main/issues/1074))

The live-updates hub: the services tell it of each change, and each signed-in person's stream hears the events that concern them. Its rules match the REST endpoints (agents hear unassigned work and their own tickets, supervisors unassigned work and their team's, admins and supervisors account changes, admins no tickets), only the event itself reaches the browser, and its comment is honest that keeping it in memory suits one API process.

But a stream judges by the account as it was when it opened, and runs until the page closes it. A deactivated agent, a session past its eight hours, or someone moved to another team or role keeps hearing by the old rules while the tab stays open. What leaks is small, event types and ticket IDs, and the app often ends it itself when the next reload is refused; the server should not depend on that. Ending streams at their session's expiry and when their person's account changes touched the account service and the API as well, so it was filed as #1073 and fixed in its own PR ([#1076](https://github.com/Terrence721/platform-main/pull/1076)): the hub ends a stream at its session's end or when an account edit ends that person's streams, the API reads the session's end from its token, and the keep-alive pings stop with the events, or they would have held the stream open. The browser reconnects through the sign-in check, which refuses or opens a stream with the current role and team.

### [`helpdesk-server/src/lib/live/ticket-audience.ts`](https://github.com/Terrence721/platform-main/blob/6f52d53/projects/helpdesk-server/src/lib/live/ticket-audience.ts)

**Low · Documentation** — 1 doc comment fixed ([issue #1077](https://github.com/Terrence721/platform-main/issues/1077))

Works out who a change to a ticket concerns, for the live updates: whoever holds it now and, on a reassignment, the agent who held it before, their teams, and whether it was or is unassigned work. It holds against its two callers, which call it only after a successful write. It reads after the change has committed, so a later change could show in it, which is fine for a nudge to reload: that change sends its own event anyway. Account edits that hand tickets back build the same shape of audience themselves. Only the comment was off: "`formerHolderId` when it held it before" now names the agent who held it before.

### [`helpdesk-server/src/lib/requests/requests.ts`](https://github.com/Terrence721/platform-main/blob/a57da93/projects/helpdesk-server/src/lib/requests/requests.ts)

**Low · Correctness** — 1 fix ([issue #1079](https://github.com/Terrence721/platform-main/issues/1079))

Where every request body is checked, shared by the API and the in-browser demo so both refuse the same requests with the same words. The readers hold: a malformed sign-in fails like a wrong password and in the same time; assignments, statuses and messages are checked as the contract says; and account bodies are refused at their first wrong field, with a message saying what is expected, leaving the team rules to the service.

The one fault was in the date beside them. `historySince` promised "the same moment, months earlier", but setting the month back rolls a missing day into the next month: from 31 May the history started on 3 March, from 31 December on 1 October, a few days short. It now stops at the last day of the earlier month, with spec cases for both and for a leap year. Two notes stay notes: `historySince` lives with the request checks only because the API and the demo both need it (its comment now says so), and an empty team ID is refused by the service with a slightly odd message, for a value the app never sends.

### [`helpdesk-server/src/lib/tickets/ticket-access.ts`](https://github.com/Terrence721/platform-main/blob/e93b7d6/projects/helpdesk-server/src/lib/tickets/ticket-access.ts)

**No findings** ([issue #1081](https://github.com/Terrence721/platform-main/issues/1081))

The one access rule for a ticket's details, its conversation and its status. You may work a ticket you hold, or one held by an agent on the team you lead; everything else, from a ticket that does not exist to someone else's or an unassigned one, gets the same 404, so nothing can be learned by probing IDs. A malformed ID is turned away before it reaches PostgreSQL, and only the ticket's own row is locked, to the end of the transaction, so checking and changing cannot be split by another write.

One thing it surfaced is left for `reports.service.ts`: "the team you lead" means only the team's lead, as My team also has it, while the Reports popup gives any supervisor on a team that team's report. Which is intended is checked there.

### [`helpdesk-server/src/lib/tickets/ticket-dto.ts`](https://github.com/Terrence721/platform-main/blob/e93b7d6/projects/helpdesk-server/src/lib/tickets/ticket-dto.ts)

**No findings** ([issue #1083](https://github.com/Terrence721/platform-main/issues/1083))

The one query and mapping behind every ticket the API sends. A ticket comes with its requester and queue, which it always has, and its assignee by a left join, so an unassigned ticket's assignee is `null`. Nothing private leaves: the assignee is an ID and a name, never the account row, and the requester's email goes because staff reply to it. The mapping builds the contract's shape field by field, so a new column, such as the finish time added for #1020, cannot reach a response unless it is added on purpose; and "most urgent first" puts the soonest due first, overdue work leading, as every work list expects.

### [`helpdesk-server/src/lib/tickets/tickets.service.ts`](https://github.com/Terrence721/platform-main/blob/5a9b084/projects/helpdesk-server/src/lib/tickets/tickets.service.ts)

**Medium-low · Correctness** — 1 race fixed ([#1085](https://github.com/Terrence721/platform-main/issues/1085)); **Low** — 1 duplicate removed ([issue #1086](https://github.com/Terrence721/platform-main/issues/1086))

Reading and changing tickets: the work lists, a member's history, taking, assigning, one ticket and status changes. Most of it holds. The lists and the history use the finish times of #1020; taking locks the ticket, so of two agents at once only the first gets it; assigning locks the ticket and keeps reassignment within the supervisor's team; reading one ticket and changing its status go through the shared access rule; and every change tells the live updates after it commits.

What is not locked is the agent. Assigning checks that the agent is active and on the team without locking their row, and taking does not check the agent inside its transaction at all, while an admin's edit hands back an agent's open tickets as it deactivates or moves them. Run at the same moment, the assignment can land after the hand-back, leaving an open ticket with an inactive agent: the stuck ticket of #1009 again. Locking the agent's row lets PostgreSQL put the two in order. The specs run on PGlite, with one connection, so the race cannot be shown there. It was filed as #1085 and fixed in its own PR ([#1088](https://github.com/Terrence721/platform-main/pull/1088)) with a spec on real PostgreSQL: it holds Sam's row as an admin's edit would, starts the real assignment or take, waits until PostgreSQL reports it waiting, then deactivates Sam. Both ended with the ticket held by inactive Sam before the fix. Now both lock the agent's row first (before the ticket, in the edit's own order, so the two cannot deadlock) and refuse: 404 to assign, 403 to take. CI runs that spec against the Docker stack's database.

Also here: `OPEN_WORK_STATUSES` was one more copy of the contract's list, which `teams.service` and `users.service` imported from this file; all three now use the contract's.

### [`helpdesk-server/src/lib/tickets/ticket-messages.service.ts`](https://github.com/Terrence721/platform-main/blob/e93b7d6/projects/helpdesk-server/src/lib/tickets/ticket-messages.service.ts)

**No findings** ([issue #1089](https://github.com/Terrence721/platform-main/issues/1089))

A ticket's conversation. Only the ticket's holder, or the lead of the holder's team, may read or write it, through the shared access rule. A closed ticket's conversation can still be read, but nothing more can be added to it; a new message marks the ticket as changed without moving when it was finished; the conversation comes oldest first in a stable order; and only an author's ID and name are sent. Unlike assigning and taking (#1085), adding a message cannot race an admin's edit of its writer: it is written under the ticket's lock, so the edit waits or goes first, and the ticket is then no longer the writer's. One thing checked and left: the seed has supervisors write only notes, but that is a choice of sample data, not a rule; the popup and the API let a holder or their lead write either.

### [`helpdesk-server/src/lib/teams/teams.service.ts`](https://github.com/Terrence721/platform-main/blob/925a9bb/projects/helpdesk-server/src/lib/teams/teams.service.ts)

**Low · Correctness** — 1 fix ([issue #1091](https://github.com/Terrence721/platform-main/issues/1091))

A supervisor's My team: the team they lead, its active agents with their open and overdue work, every unassigned ticket, and the check that one member is theirs before showing that member's tickets. It holds, including the fixes made earlier in this audit (only active agents, #1027; the contract's open-work list, #1087). The one gap was the order: agents were sorted by name only, so two people with the same name had no fixed order in My team or its Assign list. They now follow by user ID, as the Reports popup's choices already do. The check for one member also finds a deactivated agent, which keeps a former member's history reachable by its address; that is the team's own record, and left as it is.

### [`helpdesk-server/src/lib/users/users.service.ts`](https://github.com/Terrence721/platform-main/blob/925a9bb/projects/helpdesk-server/src/lib/users/users.service.ts)

**No findings** ([issue #1093](https://github.com/Terrence721/platform-main/issues/1093))

Accounts, for admins. Its edit was already fixed during this audit (open tickets handed back from a new supervisor, #1009; live streams ended on an edit, #1073), and the rest holds on a full re-read. Listing reads only what it sends, so no password hash leaves the database. Creating hashes the password before its transaction and lets the user ID's key decide when two admins pick the same one. Editing locks the account, refuses the admin's own, and locks the other admins so two admins cannot remove each other as the last; the lead rules hand a team over and leave it without a lead as they say. It locks a user before their tickets, the order assigning and taking now follow too (#1085), so the two cannot deadlock.

It also shows the question left for the reports: a lead who is replaced stays a supervisor on the team but, from then on, sees neither My team nor its tickets, while the Reports popup still gives them the team's report.

### [`helpdesk-server/src/lib/reports/reports.service.ts`](https://github.com/Terrence721/platform-main/blob/27cb6af/projects/helpdesk-server/src/lib/reports/reports.service.ts)

**Medium-low · Access** — 1 fix; **Low** — the last server duplicate removed ([issue #1095](https://github.com/Terrence721/platform-main/issues/1095))

The Reports popup's figures, and who may see which: the last of the server's 23 files. The figures hold, with finished work measured by the real finish time since #1020, first replies counting customer replies only, and medians rounded or absent as the contract says; so do the rules for admins (every team, any team or agent), agents (refused) and a team asked for together with an agent (refused).

The one rule that differed was a supervisor's. Everywhere else a supervisor works with the team they lead: My team, the tickets they may open, and the app's "You don't lead a team yet". The reports went by the team they are on, so a lead who had been replaced still got the whole team's report and every agent's figures. Agreed with the repo owner, the reports now follow the lead too: a supervisor's report and choices come from the team they lead, and one who leads none is refused with "You don't lead a team." and offered nothing, rather than, as an empty team would otherwise have meant, every team. This settles the question raised by the files before it. Also here: the open-work statuses were a SQL literal, the server's last copy of the contract's list, and are now built from it.

### [`helpdesk-api/src/database/database-url.ts`](https://github.com/Terrence721/platform-main/blob/a1aab60/projects/helpdesk-api/src/database/database-url.ts)

**No findings** ([issue #1097](https://github.com/Terrence721/platform-main/issues/1097))

The first file of `helpdesk-api`, whose review starts after the server's (23 files, complete; the summary is on [#1003](https://github.com/Terrence721/platform-main/issues/1003)). It says where the database is: `DATABASE_URL`, or the local development database when that is not set, only reading the environment its callers have loaded. In production a missing `DATABASE_URL` falls back to a local address where nothing answers inside a container, so the API fails to start rather than doing anything wrong, and Compose always sets it; left as a note.

Reading it beside its twin turned up something weightier for `auth-config.ts`: the sign-in secret falls back the same way, even in production, to the development secret published in `.env.example`, which `compose.yaml` also passes by default. Anyone who reads the repository could sign a session as any user on a deployment that forgot its own secret. That is reviewed and decided with its own file.

### [`helpdesk-api/src/database/database.module.ts`](https://github.com/Terrence721/platform-main/blob/b5da27a/projects/helpdesk-api/src/database/database.module.ts)

**Medium · Reliability** — 1 fix; **Low · Documentation** — 1 fix ([issue #1099](https://github.com/Terrence721/platform-main/issues/1099))

The API's one pool of connections to PostgreSQL, and the Drizzle client on it, available everywhere. It connects on first use, so the API starts while the database is down and the health check says so, and a new connection that takes longer than 2 seconds fails, so a silent database reads as down rather than leaving requests waiting.

The gap was a broken idle connection. When the database restarts or the network drops, node-postgres reports it as an `error` on the pool, and with nothing listening Node ends the process: one database restart took the whole API down, and Compose has no restart policy to bring it back. The pool's errors are now logged ("An idle database connection failed: …"), and the pool opens a new connection when one is next needed. A spec failed first, with the error thrown; on the Docker stack, after `docker compose restart db`, the API logged the event, stayed up, and its health check still answered `database: up`.

Also here: the comment said the pool is closed "when the API stops", which holds only when the app is closed in code (`app.close()`); no shutdown hooks are enabled, so stopping the container skips it (the system drops the connections anyway). The comment now says so; whether to enable shutdown hooks is decided with `main.ts`.

### [`helpdesk-api/src/database/setup-cli.ts`](https://github.com/Terrence721/platform-main/blob/b5da27a/projects/helpdesk-api/src/database/setup-cli.ts)

**Low · Diagnostics** — 1 fix ([issue #1101](https://github.com/Terrence721/platform-main/issues/1101))

The Docker image's first step (`node setup.js && exec node main.js`): it applies the migrations, then, with `HELPDESK_SEED=true`, seeds a database that has no users yet. It holds: the migrations are copied beside the built file, applied ones are skipped and a seeded database is left alone, so it is safe on every start; the seed runs in one transaction; a failure exits with code 1, which keeps the API from starting; and the pool is always closed. CI runs it for real in the Docker job, whose e2e tests sign in with the seeded accounts.

The gap was the failure message. Drizzle 0.45 wraps every database error, and the wrapper's message is only the failed query, with the reason in its `cause`. A failed start printed `Database setup failed: Failed query: CREATE SCHEMA IF NOT EXISTS "drizzle" params:`, which says nothing of a refused connection, a wrong password or a conflicting migration. A small helper, `errorText` in `error-text.ts` with its own spec, now prints the message and then each cause; the built `setup.js`, pointed at a closed port, says `… — connect ECONNREFUSED 127.0.0.1:1`. `seed-cli.ts` has the same line and moves to the helper in its own review.

Noted and left: this pool has no connection timeout (Compose starts the API only once the database is healthy); two containers starting at once could both migrate (Compose runs one); and the seed's default password is the published development one, which belongs with the production secret decided in `auth-config.ts`.

### [`helpdesk-api/src/database/seed/seed-cli.ts`](https://github.com/Terrence721/platform-main/blob/b5da27a/projects/helpdesk-api/src/database/seed/seed-cli.ts)

**Low · Diagnostics** — 1 fix ([issue #1103](https://github.com/Terrence721/platform-main/issues/1103))

`yarn db:seed`, which `yarn start:helpdesk` runs after migrating: it seeds the database and says how to sign in. It holds: the seed refuses a database that already has users, pointing at `yarn db:reset`, and writes everything in one transaction; variables already set win over `.env`; the summary's fields all exist, and the file is type-checked with the rest of the API although `tsx` runs it unchecked; the pool is always closed, and a failure exits with code 1, which stops `yarn start:helpdesk`.

Its failure message had the same gap as `setup-cli.ts`: `Seeding failed: Failed query: select count(*) from "users" params:`, with no reason. It now goes through `errorText` too, and against a closed port says `… — connect ECONNREFUSED 127.0.0.1:1`. Noted and left: it prints the sign-in password, a custom one included; that is what this local command is for, and the container seeds through `setup-cli.ts`, which does not.

### [`helpdesk-api/src/auth/auth-config.ts`](https://github.com/Terrence721/platform-main/blob/7e9bea1/projects/helpdesk-api/src/auth/auth-config.ts)

**Medium · Security** — 1 fix ([issue #1105](https://github.com/Terrence721/platform-main/issues/1105))

The sign-in secret and the session cookie's settings. The cookie holds: httpOnly, SameSite=Strict, sent only to `/api`, for the contract's hours, and Secure in production; the Docker stack runs as production over plain HTTP and still works, because browsers treat `localhost` as secure, as its e2e sign-ins show. The secret is read at start-up, after `.env` is loaded.

The gap was the one `database-url.ts` pointed at. The secret fell back to the development one in every mode, production included, and `compose.yaml` passed it by default; the comment said any real deployment must set its own, but nothing made it. That secret is published in this repository, so the image, run anywhere reachable without its own secret, would accept a session cookie anyone signed, as any admin. Everything binds to `127.0.0.1` and nothing is deployed, so the exposure was small, but the default was unsafe. Agreed with the repo owner (option A of three, the others being a hard refusal that would have made every Docker run set a secret first, or comments only): in production an unset secret is now a random one made at each start, with a warning that sessions end when the API restarts, and the development secret, or any shorter than 32 characters, stops the API from starting. `compose.yaml` and `.env.example` no longer pass the development secret, so `yarn start:helpdesk:docker` needs no setup, and `nx serve` keeps the development secret so a rebuild signs no one out. Three specs failed first; on the Docker stack the e2e suite passes, the API logs the warning, and given the development secret it exits with the reason.

### [`helpdesk-api/src/auth/auth.service.ts`](https://github.com/Terrence721/platform-main/blob/f9f8529/projects/helpdesk-api/src/auth/auth.service.ts)

**Low · Documentation** — 1 fix ([issue #1107](https://github.com/Terrence721/platform-main/issues/1107))

Signs users in and recognizes them on each request. It holds. A failed sign-in is always the same `null`, for a wrong password, an unknown or inactive user, a malformed user ID or an over-long password, and an unknown user is checked against a dummy hash of the same cost, so whether a user ID exists cannot be told. Each request reads the user's role, team and whether they are active from the database rather than trusting the token, so a deactivation ends the session at once; wrong-secret, expired and broken tokens are refused, and the password hash never leaves. With no way to change a password, no session outlives one.

The one gap was a claim: the comment said every failed sign-in looks the same "in its timing", but an over-long password is refused before any hashing, so it is quicker. That gives nothing away, as it does not depend on the user ID, and the comment now says what holds: the same answer, taking as long, whether or not the user ID exists. Also here, a spec for an unsigned (`alg: none`) token, which the library already refuses; it keeps a later `algorithms` option from undoing that. Left for `auth.controller.ts`: sign-in has no rate limit, though each attempt costs about half a second of scrypt work and 128 MB.

### [`helpdesk-api/src/auth/auth.guard.ts`](https://github.com/Terrence721/platform-main/blob/7e9bea1/projects/helpdesk-api/src/auth/auth.guard.ts)

**No findings** ([issue #1109](https://github.com/Terrence721/platform-main/issues/1109))

Lets a request through only with a valid session for an active user, and attaches that user. It reads exactly the session cookie and fails closed: no cookies (so also if cookie-parser were missing), other cookies only, or a session the service does not recognize are each a 401 that says nothing more and attaches nobody, and `@SignedInUser` answers 401 rather than hand an endpoint `undefined` if the guard is missing. Today every one of the 16 routes outside `/health` and `/auth` (20 in all) is behind it, through `@OnlyFor(...)`.

Mapping those routes turned up one thing for `role.guard.ts`: its comment says a forgotten `OnlyFor` fails safe, closed to everyone, but `OnlyFor` is what attaches both guards, so an endpoint without it has none and is public. Nothing is exposed now; the next endpoint that forgets it would be. That is decided with its own file.

### [`helpdesk-api/src/auth/role.guard.ts`](https://github.com/Terrence721/platform-main/blob/93a8e18/projects/helpdesk-api/src/auth/role.guard.ts)

**Medium-low · Access control** — 1 fix ([issue #1111](https://github.com/Terrence721/platform-main/issues/1111))

`@OnlyFor(...roles)` and the role guard it attaches with AuthGuard. The rules hold, each proven over real HTTP: on a method the right role gets in, another gets 403 and someone signed out 401; on a controller the roles apply to its methods, and a method's own win; with several roles each one listed gets in.

The gap was the safety net its comment promised: "an endpoint without roles is closed to everyone, so a forgotten `OnlyFor` fails safe". The spec proved only that the role guard, added by hand without roles, answers 403. But `OnlyFor` is what attaches both guards, so the real mistake, leaving it out, leaves the endpoint with no guard at all, open to anyone. Nothing is exposed today, as every one of the 16 routes outside `/health` and `/auth` has it. Agreed with the repo owner (option A of two, the other being global guards with a `@Public()` marker): a spec now walks every route reachable from `AppModule`, through imported and dynamic modules, and expects exactly the four open ones (`GET /health`, `POST /auth/sign-in`, `GET /auth/me`, `POST /auth/sign-out`); another checks that it finds all 20 routes, and a third that it shows a route which forgot `OnlyFor` in an imported module. The comments now say what holds. Noted and left: `OnlyFor` on both a controller and its method would run the guards twice; no controller does that.

Writing that spec also corrected the count in the review of `auth.guard.ts`, which had said 20 routes outside `/health` and `/auth`.

### [`helpdesk-api/src/auth/auth.controller.ts`](https://github.com/Terrence721/platform-main/blob/31a55b3/projects/helpdesk-api/src/auth/auth.controller.ts)

**Medium · Security** — 1 fix; **Low · Security** — 1 fix ([issue #1113](https://github.com/Terrence721/platform-main/issues/1113))

`/api/auth`: signing in and out, and who is signed in. What it promised holds: a failed sign-in is 401 with the one message and no cookie, the session travels only in the cookie, `GET /auth/me` always answers 200 with the user or `null`, and signing out drops the cookie with the settings it was set with.

What it lacked was a limit. Passwords could be guessed without end, and as each check costs about half a second of scrypt work and 128 MB, four at a time, a burst of sign-ins, even for made-up user IDs, could hold up everyone's. Agreed with the repo owner (option A of three, the others being a per-address limit through `@nestjs/throttler`, which behind nginx needs the forwarded address trusted, or a note only), a new `SignInLimits` keeps two limits in memory. After 5 failed sign-ins for one user ID in 15 minutes, that ID gets 429 with `Retry-After` before any password is checked, and a success clears its count; a user ID nobody has is counted like any other, so a wait shows nothing about it, and malformed ones share one count, so made-up values cannot fill the memory. At most 4 sign-ins are checked at once and 16 more wait their turn; beyond that the answer is 429 at once. The trade-off is the usual one: someone who knows a user ID can make that user wait up to 15 minutes.

The second gap was the body it accepted: an HTML form post signed in too, so a page on another site could post a hidden form and sign its visitor in to the attacker's account. Sign-in now accepts only JSON, and anything else gets the same 401; other endpoints were never open to this, as a cross-site form does not carry the SameSite=Strict cookie. The two controller specs failed first; on the Docker stack, through nginx, five wrong passwords and then the right one gave 429 with `Retry-After: 898`, a form post 401, and the e2e suite passes. Noted and left: the app shows its "isn't available right now" message for a 429 and could say how long (for its review), and signing out drops the cookie without revoking the token, as usual with stateless JWTs.

### [`helpdesk-api/src/auth/auth.module.ts`](https://github.com/Terrence721/platform-main/blob/8f72570/projects/helpdesk-api/src/auth/auth.module.ts)

**No findings** ([issue #1115](https://github.com/Terrence721/platform-main/issues/1115))

Wires the JWT module, the controller, `AuthService`, `AuthGuard` and `SignInLimits`. Its one comment holds: the secret comes from a factory because imports run before `main.ts`'s own code, so `register({ secret: jwtSecret() })` would read the environment before `.env` is loaded. Nest makes the module once, though five feature modules import it, so production's random secret (#1105) is one per start, as the Docker check showed with a single warning. The token's lifetime and the cookie's both come from `SESSION_HOURS`; it exports only what `@OnlyFor` needs elsewhere, keeping `SignInLimits` to itself; and with a shared secret, tokens are signed with HS256 and only shared-secret algorithms are accepted, `alg: none` refused under its own spec. Noted and left: pinning HS256 would only matter after a switch to key pairs.

### [`helpdesk-api/src/live/events.controller.ts`](https://github.com/Terrence721/platform-main/blob/f9f8529/projects/helpdesk-api/src/live/events.controller.ts)

**No findings** ([issue #1117](https://github.com/Terrence721/platform-main/issues/1117))

The live updates stream, `/api/events`, as reworked by #1073 during the server's review. It holds, each rule under a spec: any signed-in role may open it and someone signed out gets 401; only the events that concern the person are sent, as `message` JSON; a `ping` every 25 seconds keeps a quiet stream open, and pages ignore it, as `EventSource` hands them only messages; and the stream ends, pings and all, when the session ends or the person's account changes, and only theirs. A token that expired between the guard and the stream ends it at once, and when the page closes, Nest unsubscribes. nginx passes it on as it comes (no buffering, HTTP/1.1 keep-alive, an hour's read timeout), which the e2e live-update tests go through. Noted and left: a person may open as many streams as tabs, signed-in staff only and each cheap; and for a token already expired, `share()` resets on the immediate end, so the events are subscribed twice, both ending at once.

### [`helpdesk-api/src/live/live.module.ts`](https://github.com/Terrence721/platform-main/blob/6f52d53/projects/helpdesk-api/src/live/live.module.ts)

**No findings** ([issue #1119](https://github.com/Terrence721/platform-main/issues/1119))

Live updates: the one `LiveEvents` and the stream's controller. It holds. `LiveEvents` is provided here and nowhere else, which matters, as a second copy would have its own listeners and the stream would never hear what was published; the module is global, so the publishers (`TicketsService` and `TicketMessagesService` in the tickets module, `UsersService` in the users module) share it without importing it, and the e2e live-update tests on the Docker stack show one person's change reaching another's open stream. It imports `AuthModule` for the guard the stream is behind, as its comment says.

### [`helpdesk-api/src/tickets/tickets.controller.ts`](https://github.com/Terrence721/platform-main/blob/e93b7d6/projects/helpdesk-api/src/tickets/tickets.controller.ts)

**No findings** ([issue #1121](https://github.com/Terrence721/platform-main/issues/1121))

`/api/tickets`, for the people who work them. It holds, under its specs. Each route is open to the roles of the page that uses it: agents alone for their own tickets, the unassigned ones and their finished ones; agents and supervisors for assigning, one ticket, its status and its conversation. A supervisor assigns within the team they lead, and an agent may only take a ticket for themselves, refused with 403 before anything is read. A ticket ID that is not a UUID would make PostgreSQL throw, but every path checks its form first and answers 404: assigning, taking, and the one access rule behind a ticket's details, status and conversation. `GET :ticketId` comes after `mine` and `unassigned`, as its comment says, and every body is read through the server library's readers, a bad one answered 400 with nothing changed. The status codes its comments list match the service's, as reviewed with the server.

### [`helpdesk-api/src/tickets/tickets.module.ts`](https://github.com/Terrence721/platform-main/blob/b5da27a/projects/helpdesk-api/src/tickets/tickets.module.ts)

**No findings** ([issue #1123](https://github.com/Terrence721/platform-main/issues/1123))

Tickets for the people who work them. It provides the controller's two services, whose database and live events come from the global modules, and exports `TicketsService` for features that show someone's tickets, as its comment says: its one user outside is the teams controller, whose module imports this one, so both share the same service. It imports `AuthModule` for the guard every route here is behind, and nothing is provided twice.

### [`helpdesk-api/src/teams/teams.controller.ts`](https://github.com/Terrence721/platform-main/blob/ff2bace/projects/helpdesk-api/src/teams/teams.controller.ts)

**Low · Consistency** — 1 fix ([issue #1125](https://github.com/Terrence721/platform-main/issues/1125))

`/api/teams`, for the supervisors who lead them. It holds, under its specs: supervisors only, with the team not even read for anyone else; `GET mine` gives the team the supervisor leads, the rule settled in #1095, or 404 for none; and one agent's tickets or history are given only for an agent on that team, another team's agent and a user ID nobody has getting the same 404 with nothing read, so a supervisor cannot learn who exists elsewhere. The three months of history come from `historySince`, whose month-end handling was fixed earlier in this audit.

The one gap was wording: a supervisor who leads no team was told "You do not lead a team." here, and "You don't lead a team." by the Reports API (#1095), which exports the message as `NO_TEAM_MESSAGE` for this case. This controller, and the in-browser demo's copy of it, now use that constant; the spec expects it, and failed first. The app's My team page shows its own words, "You don't lead a team yet."

### [`helpdesk-api/src/teams/teams.module.ts`](https://github.com/Terrence721/platform-main/blob/b5da27a/projects/helpdesk-api/src/teams/teams.module.ts)

**No findings** ([issue #1127](https://github.com/Terrence721/platform-main/issues/1127))

Teams for the supervisors who lead them. As its comment says, it imports `AuthModule` for the guard every route here is behind, and `TicketsModule` for the members' tickets and history; `TeamsService` needs only the database, from the global module. Nothing outside the teams files uses that service, so it is rightly not exported, and nothing is provided twice.

### [`helpdesk-api/src/users/users.controller.ts`](https://github.com/Terrence721/platform-main/blob/a57da93/projects/helpdesk-api/src/users/users.controller.ts)

**No findings** ([issue #1129](https://github.com/Terrence721/platform-main/issues/1129))

Helpdesk accounts, for admins. It holds, under its specs: admins alone may list, create or edit accounts, with nothing read, created or changed for anyone else; every body goes through the server library's readers, a wrong field answered 400 with its message; and the service's answers come through as its comments say, 409 for a taken user ID, for the admin's own account or for leaving no active admin, and 404 for no such account. An edit is made as the signed-in admin, which is how the service can refuse their own account. No password hash leaves, as the service reads only what it sends.

### [`helpdesk-api/src/users/users.module.ts`](https://github.com/Terrence721/platform-main/blob/b5da27a/projects/helpdesk-api/src/users/users.module.ts)

**No findings** ([issue #1131](https://github.com/Terrence721/platform-main/issues/1131))

Helpdesk accounts for admins. It imports `AuthModule` for the guard every route here is behind, as its comment says; `UsersService` takes the database from the global module, and `LiveEvents`, through which an account edit ends that person's streams (#1073), from the global `LiveModule`. Nothing outside the users files uses the service, so nothing is exported or provided twice.

Left for `app.module.ts`: this service and the two ticket services take `LiveEvents` as optional, since the in-browser demo builds them without it, so in the API a wiring mistake, such as a second `LiveEvents` provided elsewhere, would fail without a word: live updates would stop reaching anyone, and a deactivated person's stream would no longer end. A spec there can check that all three share the stream's `LiveEvents`.

### [`helpdesk-api/src/reports/reports.controller.ts`](https://github.com/Terrence721/platform-main/blob/27cb6af/projects/helpdesk-api/src/reports/reports.controller.ts)

**Low · Documentation** — 1 fix ([issue #1133](https://github.com/Terrence721/platform-main/issues/1133))

The Reports popup's figures. The controller only hands the service the caller and the `?team=` or `?agent=` they picked, by the contract's names, and its spec checks exactly that, with the service's 404 and 400 passed on and agents (403) and the signed out (401) turned away before anything is read. The rules themselves are the service's, as settled in #1095. Its comment still described the time before that: supervisors got "their own team". It now says the team they lead, and that one who leads none gets 404. Noted and left: a repeated parameter, `?team=a&team=b`, reaches the service as a list though declared as text, but PostgreSQL then compares it as the text `{"a","b"}`, matches nothing, and the answer is the usual 404.

### [`helpdesk-api/src/reports/reports.module.ts`](https://github.com/Terrence721/platform-main/blob/4b8d8f1/projects/helpdesk-api/src/reports/reports.module.ts)

**Low · Documentation** — 1 fix ([issue #1135](https://github.com/Terrence721/platform-main/issues/1135))

The Reports figures for supervisors and admins. It imports `AuthModule` for the guard its one route is behind; `ReportsService` needs only the database, from the global module; and as nothing outside the reports files uses the service, nothing is exported or provided twice. Its comment called them the Reports page's figures, from before they moved into a popup (#967); it now says popup, as the controller's comment does.

### [`helpdesk-api/src/app/health.controller.ts`](https://github.com/Terrence721/platform-main/blob/a1aab60/projects/helpdesk-api/src/app/health.controller.ts)

**No findings** ([issue #1137](https://github.com/Terrence721/platform-main/issues/1137))

`GET /api/health`. It answers 200 while the API runs and says whether the database answers, a database that is down being reported rather than turned into an error; its specs show both over real HTTP, and that it answers only under `/api`. That fits the Docker health check: a silent database fails the `select 1` after the 2-second connection timeout, inside the check's 3 seconds, and after a database restart (#1101) it answered `database: up` again. It is open to anyone on purpose, one of the four routes the route walk allows (#1111), and shows only up or down. Noted and left: a database that accepts connections but never answers would leave the `select 1` waiting, with no statement timeout, so Docker would mark the API unhealthy instead; a rare fault, and still a visible one.

### [`helpdesk-api/src/app/app.module.ts`](https://github.com/Terrence721/platform-main/blob/6f52d53/projects/helpdesk-api/src/app/app.module.ts)

**Low · Test coverage** — 1 spec added ([issue #1139](https://github.com/Terrence721/platform-main/issues/1139))

The API's root module: the seven feature modules and the health check, each named in its comment with its route. The global database and live-events modules are imported once, so the whole API shares one pool and one `LiveEvents`, as the module reviews before it checked one by one, and the route walk (#1111) starts here, so every route it can reach is checked for its roles.

What nothing checked was the point the `users.module.ts` review raised. The three services that publish live events, two for tickets and one for accounts, take `LiveEvents` as optional, because the in-browser demo builds them without it; in the API, a mis-wiring such as a module providing its own would start without a word, and live updates, and the ending of a deactivated person's stream (#1073), would quietly stop. Only the e2e tests would have noticed. A new `app.module.spec.ts` builds the real `AppModule`, which reaches no database until a query runs, and checks that all three services hold the very `LiveEvents` the `/api/events` controller listens to; a second spec builds a module with its own `LiveEvents` and shows the check would catch it.

### [`helpdesk-api/src/main.ts`](https://github.com/Terrence721/platform-main/blob/077674a/projects/helpdesk-api/src/main.ts)

**Low · Reliability** — 1 fix ([issue #1141](https://github.com/Terrence721/platform-main/issues/1141))

Starts the API: `.env` from the repo root when there is one, with the environment winning; Express named so the build lists it for the image; the `/api` prefix and the cookie reader the guard needs. A start that fails, such as the refused development secret of #1105, logs why and exits with code 1.

What it lacked was a way to stop. The image runs `exec node main.js`, so Node is process 1, which on Linux ignores SIGTERM unless something handles it, and nothing did, as Nest's shutdown hooks were not enabled. Every `docker stop` waited out Docker's grace period and killed the API, exit code 137: the database connections were cut rather than closed, the pool's `onModuleDestroy` never running, and live updates streams were cut too. Nothing was corrupted, as PostgreSQL rolls back and pages reconnect. Agreed with the repo owner (option A of three, the others being an init process in `compose.yaml`, which would still cut the connections, or a note only), the app now enables its shutdown hooks and is created with `forceCloseConnections`, without which closing would wait on every open stream, as they never end on their own. On the Docker stack, with a signed-in stream open and its first ping received, `docker compose stop api` now takes 0.75 seconds and exits with code 0, the stream ended by the API. This also makes true, on `docker stop`, what `database.module.ts`'s comment says about closing the pool.

### [`helpdesk-api/Dockerfile`](https://github.com/Terrence721/platform-main/blob/49b3676/projects/helpdesk-api/Dockerfile)

**Medium-low · Supply chain** — 1 fix ([issue #1143](https://github.com/Terrence721/platform-main/issues/1143))

The API's image, and the last of its 24 files. The build stage installs the workspace, its slow step cached until the package list changes, and builds as CI does; the run stage holds only the built API, its migrations and the packages it loads, runs as `node` rather than root, checks `/api/health`, and hands process 1 to Node, which since #1142 stops cleanly. `.dockerignore` keeps `node_modules`, build output, `.env` and `.git` out.

The gap was in what it installed. Only the API's ten direct dependencies were pinned; everything beneath them came from `npm install` with no lockfile, after the generated `yarn.lock` was deleted, so each build took whatever was newest that day rather than what CI had tested. The image built during this review already held four versions never in `yarn.lock`, two of them, `content-type` and `negotiator`, read by Express on every request, and a bad release could have reached the image without passing through a pull request. npm had been chosen because the lockfile Nx generates is incomplete, missing the 22 entries under `qs`, which Yarn's `--immutable` refuses; `webpack.config.cjs` still said the output got "a lockfile pinning them". Agreed with the repo owner (option A of three, the others being a second, committed npm lockfile for the API, or a note only), the run stage now installs with Yarn, into `node_modules`, from the repo's own `yarn.lock`, which has every entry; Yarn drops what the API does not use and is removed, with its caches, in the same step. A first try with Nx's lockfile still left four fresh versions; the repo's leaves none: all 133 packages in the image are now the versions in `yarn.lock`, at 289 MB against 290. The e2e suite passes on the new image, and the API still stops cleanly. Both comments now say how it works.

### [`helpdesk/src/app/tickets/ticket-api-paths.ts`](https://github.com/Terrence721/platform-main/blob/c029217/projects/helpdesk/src/app/tickets/ticket-api-paths.ts)

**No findings** ([issue #1146](https://github.com/Terrence721/platform-main/issues/1146))

The first of the app's 63 files, reviewed after the API's (24 files, complete; the summary is on [#1004](https://github.com/Terrence721/platform-main/issues/1004)). Where the app reads and changes one ticket: its details, its assignee, its status and its conversation, each path the route the API declares for it, with the ticket ID encoded so it cannot leave its place in the path. The three stores that call these use the functions rather than writing the paths themselves. Their specs use the same functions, so a wrong path would pass them, but the e2e tests drive every one through the real API on the Docker stack: an agent takes a ticket, moves it on and replies, a supervisor assigns one and adds a note, and an open popup's details follow the ticket live.

### [`helpdesk/src/app/tickets/api-error-message.ts`](https://github.com/Terrence721/platform-main/blob/5b8e937/projects/helpdesk/src/app/tickets/api-error-message.ts)

**No findings** ([issue #1148](https://github.com/Terrence721/platform-main/issues/1148))

The words shown when the API refuses a ticket action: the API's own message for the refusals it explains (400, 403, 404, 409), the action's fallback for anything else. Its spec covers each of those codes, and the fallback for a server error, no answer at all, a refusal without a message or with one that is not text, and an error that is not from HTTP. Taking, status changes, assigning and sending a message all use it, each with a fallback of its own.

It turned up two things for later files. The admin store keeps its own copy, for 400, 404 and 409, to be replaced by this one in its review. And a session that ends while a page is open, after its 8 hours, is never explained: the next action gets 401 and shows that action's fallback, asking the person to try again, which will never work; only the live updates stream reacts to a 401. Treating a 401 from any API call but the session check and sign-in as "signed out", app-wide, is a decision for the session effects or the app's configuration.

### [`helpdesk/src/app/sound/sounds.ts`](https://github.com/Terrence721/platform-main/blob/959a519/projects/helpdesk/src/app/sound/sounds.ts)

**Low · Design** — 1 fix to follow in its own PR ([issue #1150](https://github.com/Terrence721/platform-main/issues/1150))

The help desk's sounds (#941). It holds, under its spec: three short, quiet tones made in code, each told apart; on until someone mutes them, the choice remembered in this browser, or for the visit where storage is not allowed; the audio opened on the first sound and woken if the browser paused it; and where there is no audio, or it breaks, nothing plays and nothing fails. Each sound goes with something shown, never on its own.

The one thing out of place is `isFinished`, resolved or closed: a ticket rule kept in the sounds file, and written out at least six times, here, in the ticket table and the conversation popup, and on the server in the tickets service (twice) and the seed. The contract holds the matching list for open work, the one copy since #1087 and #1095, but none for finished work. As it spans three projects, it gets its own issue and PR: `FINISHED_STATUSES` and `isFinished` in the contract, with a spec, and every copy switched to it. Done in [#1153](https://github.com/Terrence721/platform-main/pull/1153) ([issue #1152](https://github.com/Terrence721/platform-main/issues/1152)): there were five copies, not six, as one was a check for closed tickets alone; a new contract spec, which failed first, makes sure open and finished work together cover every status, with none in both.
