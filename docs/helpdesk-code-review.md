# Helpdesk Code Review Results

<!-- markdownlint-disable-next-line MD036 -->

**Last Updated: October 8, 2026** (`helpdesk-contract` complete: 11 of 11; `helpdesk-server` complete: 23 of 23; `helpdesk-api` complete: 24 of 24; `helpdesk` in progress: 51 of 63)

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

### [`helpdesk/src/app/router.selectors.ts`](https://github.com/Terrence721/platform-main/blob/41acb57/projects/helpdesk/src/app/router.selectors.ts)

**No findings** ([issue #1154](https://github.com/Terrence721/platform-main/issues/1154))

Which landing-page section the URL points at, so the toolbar can mark its link, with `aria-current="location"` for screen readers. It gives the section the fragment names, or nothing for no fragment, an unknown one, or before the router's first navigation, each case under its spec, as is the sections' page order; the three names are the ids the landing page's sections carry. Its comment holds too: the router's slice is read directly because `createFeatureSelector` warns in development while a slice is missing, as this one is until the first navigation. Left for `landing.page.ts`: nothing ties this list to those ids, so renaming one would quietly break its link.

### [`helpdesk/src/app/session/session.actions.ts`](https://github.com/Terrence721/platform-main/blob/a8a2046/projects/helpdesk/src/app/session/session.actions.ts)

**No findings** ([issue #1156](https://github.com/Terrence721/platform-main/issues/1156))

The session's actions: what the API says (signed in, a failed sign-in, a session restored or none on start-up, signed out) and the toolbar's Sign out. Each is used, by the session's effects and reducer and, for a sign-in, by the popup and the in-browser demo. Its one comment holds: a failed sign-in carries a `message`, not an `error`, because the app-wide snack bar shows any action with an `error`, and the popup already shows it. If a session that ends during work is to be handled app-wide, the open question from `api-error-message.ts`, an action for it would most likely join these; that is decided with the session's effects.

### [`helpdesk/src/app/session/session.feature.ts`](https://github.com/Terrence721/platform-main/blob/a8a2046/projects/helpdesk/src/app/session/session.feature.ts)

**No findings** ([issue #1158](https://github.com/Terrence721/platform-main/issues/1158))

The session's state: who is signed in, whether the start-up check has answered, so a reload is not taken for being signed out, and why the last sign-in failed. Each change is under its spec: signing in or a restored session sets the user and clears any error, a failed sign-in keeps its message until the form is sent again, and no session or signing out returns to signed out. Each role's home page is the route `app.routes.ts` declares for it, and the spec makes sure there is one for exactly the contract's roles. A failed attempt's message does not come back when the popup is opened again, as the popup shows it only after its own send. Left for `sign-in.actions.ts`: its comment still speaks of a later "auth phase" adding the sign-in effect, which has long been done.

### [`helpdesk/src/app/session/session.effects.ts`](https://github.com/Terrence721/platform-main/blob/959a519/projects/helpdesk/src/app/session/session.effects.ts)

**Low · Usability** — 1 fix; **Low · Documentation** — 1 fix ([issue #1160](https://github.com/Terrence721/platform-main/issues/1160))

Signing in and out, and the session check on start-up. It holds, under its spec: a session the browser still has is restored, and nobody, a 401 or an API that cannot be reached means none; a second send while signing in is ignored; wrong details get the contract's one message and anything else a different one, so nobody retypes a correct password; a chime or a low tone goes with the result, and then the person's own page; and signing out counts even when the API cannot be reached.

The gap was the sign-in limit from #1113. After too many tries the API answers 429 with how long to wait, but the popup said only that signing in "isn't available right now. Please try again", inviting more tries that would each be refused, for up to fifteen minutes. It now says "Too many sign-in attempts. Please try again in 15 minutes.", the minutes from `Retry-After`, "in a moment" for a minute or less, "later" without a usable header; five specs failed first. Also here, the comment on where the auth endpoints are named only the dev server's proxy; it now names nginx in the image and the in-browser demo's API too.

Decided with the repo owner, from the open question in `api-error-message.ts`: a session that ends during work will be handled app-wide, an interceptor turning a 401 from any API call but the session check, sign-in and sign-out into "session ended": signed out, back to the landing page, the sign-in popup saying so. It touches several files, so it follows in its own issue and PR. Done in [#1163](https://github.com/Terrence721/platform-main/pull/1163) ([issue #1162](https://github.com/Terrence721/platform-main/issues/1162)): a new interceptor turns that 401 into Session Ended, once however many calls fail together, the popup opens on the landing page with "Your session has ended. Please sign in again.", and an e2e test closes an agent's account while their page is open and checks their next action brings them there.

### [`helpdesk/src/app/session/role.guard.ts`](https://github.com/Terrence721/platform-main/blob/a8a2046/projects/helpdesk/src/app/session/role.guard.ts)

**No findings** ([issue #1164](https://github.com/Terrence721/platform-main/issues/1164))

Which role may open each page. Each of the three role pages uses it, and it holds under its spec: the page's own role gets in, another role is sent to its own page, and someone signed out to the landing page with the sign-in popup open. It waits for the start-up session check first, so reloading a role's page is not taken for being signed out. Being a `canMatch` guard, it keeps a page's code and state from loading until the visitor is let in, and it sits apart from the new ended-session handling, whose effect goes to the landing page itself. Left for `app.routes.ts`: there is no catch-all route, so a mistyped address matches nothing and shows an empty page.

### [`helpdesk/src/app/sign-in/sign-in.actions.ts`](https://github.com/Terrence721/platform-main/blob/41acb57/projects/helpdesk/src/app/sign-in/sign-in.actions.ts)

**Low · Documentation** — 1 fix ([issue #1166](https://github.com/Terrence721/platform-main/issues/1166))

The sign-in popup's one action, Submitted, with the user ID and password. The popup dispatches it, the session effects send it to the API, the session state clears the last error and notice on it, and the devtools are shown a copy with the password hidden, never the password itself, which is not kept in the state either. Its comment, though, still said a later "auth phase" would add the effect that calls the API, long since done; it now names that effect and the sanitizer. The contract's `SignInRequest`, an interface, is now imported as a type, as the session's actions import theirs.

### [`helpdesk/src/app/sign-in/hide-passwords.ts`](https://github.com/Terrence721/platform-main/blob/41acb57/projects/helpdesk/src/app/sign-in/hide-passwords.ts)

**No findings** ([issue #1168](https://github.com/Terrence721/platform-main/issues/1168))

The store devtools' action sanitizer. Under its spec, the devtools are shown a sign-in with the password replaced by dots and the user ID kept, while the store and effects get the real action, untouched, and every other action passes as it is. It is the only action that needs it: the admin's starting password in Create account goes from the accounts signal store straight to the API, not as an action, and that store is not connected to the devtools. The devtools run in production builds too, log-only, with the same sanitizer, so a password reaches them in neither.

### [`helpdesk/src/app/sign-in/sign-in-dialog.ts`](https://github.com/Terrence721/platform-main/blob/4499c1c/projects/helpdesk/src/app/sign-in/sign-in-dialog.ts)

**Low · Usability** — 1 fix ([issue #1170](https://github.com/Terrence721/platform-main/issues/1170))

The sign-in popup. It holds, under its spec: the user ID and password are checked against the contract's rules before anything is sent, each mistake with its own message; password managers can fill it in; it sends once and waits, its button off meanwhile; a failure shows under the form and is read out, one from before it opened never; the password can be shown and hidden, the button saying which; and it closes once signed in.

The one gap was mine, from #1163. The notice that a session had ended was cleared only by sending the form or signing in, so it outlived its popup: closed with Cancel, a popup opened later from the toolbar still said the session had ended. The popup now says when it goes away, however that happens, and the session state drops the notice; two specs failed first.

### [`helpdesk/src/app/sign-in/sign-in-launcher.ts`](https://github.com/Terrence721/platform-main/blob/41acb57/projects/helpdesk/src/app/sign-in/sign-in-launcher.ts)

**No findings** ([issue #1172](https://github.com/Terrence721/platform-main/issues/1172))

Opens the sign-in popup, for the two Sign in buttons, the role guard and the ended-session effect. The popup's code and Material's dialogs are fetched on the first open, so visitors who never sign in never download them. Under its spec, two quick clicks open one popup, none opens over another, and it fits narrow screens; and as the ended-session effect opens it only once the landing page is reached, Material's closing of dialogs on navigation does not take it away again. Noted and left: should the popup's code fail to download, offline or in an old tab across a deploy of the demo, the button does nothing and says nothing until a reload, as is so for every page the app loads on demand.

### [`helpdesk/src/app/live/live-updates.ts`](https://github.com/Terrence721/platform-main/blob/d51b960/projects/helpdesk/src/app/live/live-updates.ts)

**Medium-low · Reliability** — 1 fix ([issue #1174](https://github.com/Terrence721/platform-main/issues/1174))

The app's one live updates stream. It holds, under its spec: one stream while someone is signed in, shared by every page that listens and closed when none does; opened on sign-in and closed on sign-out, a fresh one for another person and the same one kept for the same person; only live events passed on; and after a network break, which the browser mends by itself, pages told to load again. The in-browser demo, which has no server, opens none.

The gap was the break the browser does not mend. While the API restarts, after an update or a crash, nginx answers the stream with 502, and a browser gives up on a stream for good after an HTTP error: a probe with Node's `EventSource` against a 502 made one try and closed. So after any API restart every open page stopped hearing about changes, without a word, until it was reloaded. Now, when the stream is closed for good, the app asks who is signed in: still signed in, it opens the stream again and pages load again; nobody, the session has ended (#1163), and the person is told at once instead of at their next action; no answer, it asks again after two seconds, waiting twice as long each time up to a minute, until signed out. Five specs failed first. A new e2e test proves it on the Docker stack: with a fixed sign-in secret, so that sessions outlive the restart, an agent's page is open when the API restarts, and a ticket their lead assigns afterwards still appears on it, live.

### [`helpdesk/src/app/tickets/ticket-table.ts`](https://github.com/Terrence721/platform-main/blob/8365add/projects/helpdesk/src/app/tickets/ticket-table.ts)

**Medium-low · Usability** — 1 fix; **Low · Documentation** — 1 fix ([issue #1176](https://github.com/Terrence721/platform-main/issues/1176))

The ticket table on the agent's and the supervisor's pages. It holds, under its spec: a column for each thing a worker needs to pick a ticket, priority as a chip tinted for high and urgent, and time left against the SLA, overdue in the error color and in words, or "Finished" once resolved or closed; the order given until a header is clicked, priority and status sorting in workflow order, Due soonest first with no SLA last, numbers as numbers; and, as asked for, an action button on the rows allowed it, still the right ticket after sorting, a menu of only the status moves the workflow allows, and subject links that open the ticket.

The gap was time. Time left was worked out once, when the tickets arrived, as the comment said, but a page stays open all shift and loads again only when a live update concerns it: "Due in 10 min" could still read so an hour later, and a ticket that fell overdue never turned red, which is the one thing that column is for. The table now keeps its own clock, ticking every minute as the label reads in whole minutes, so the text and color keep up by themselves; a spec failed first, a ticket due in a minute reading "Overdue 1m" two minutes on with no new data. The class comment, which had a stray line break mid-sentence, now says so. Left for later files: the ticket popup's Due label goes stale the same way, and this table and both pages take `slaLabel` and the status guide from the landing page's stores, a question for the landing reviews.

### [`helpdesk/src/app/tickets/ticket-conversation.store.ts`](https://github.com/Terrence721/platform-main/blob/c029217/projects/helpdesk/src/app/tickets/ticket-conversation.store.ts)

**Low · Correctness** — 1 fix ([issue #1178](https://github.com/Terrence721/platform-main/issues/1178))

The ticket popup's data: the ticket, its replies and notes, and sending one. It holds, under its spec: the conversation loads as the popup opens, a failure saying so and offering another try; a message is sent once however often it is clicked, refusals in the API's own words; while the popup is open, someone else's message fetches the conversation again quietly, with the arrival tone, and a change to the ticket reads its details again, both also when the stream comes back; events for other tickets are ignored and a failed fetch keeps what is shown; and a ticket given to someone the person does not lead is marked as no longer theirs, until a later read finds it theirs again.

The gap was the writer's own message. They hear its live event too, as they hold the ticket or lead the team of the one who does, and the event fetches the whole conversation, the new message in it. If that fetch came back before the send's own answer, which the code's comment already allowed for the sound, the send then added the message a second time. It is unlikely, as the fetch needs one more round trip, but now the send adds its message only if it is not already shown; a spec for that order failed first.

### [`helpdesk/src/app/tickets/ticket-conversation.dialog.ts`](https://github.com/Terrence721/platform-main/blob/8365add/projects/helpdesk/src/app/tickets/ticket-conversation.dialog.ts)

**Low · Usability** — 1 fix; **Low · Accessibility** — 1 fix ([issue #1180](https://github.com/Terrence721/platform-main/issues/1180))

The ticket popup. It holds, under its spec: the ticket's details, its holder shown as "Someone else" once it is no longer the person's; the conversation, the customer's description first, then each reply and note, notes tinted as only staff see them; a spinner while it loads and a way to try again; and a box for a reply or a note, counting up to the contract's limit, its buttons off while it is empty or sending, refusals read out, cleared after a send, and taken away, with a word why, once the ticket is closed or no longer theirs.

Two gaps. Its time left was worked out from when the ticket was last read, as the comment said, so a popup left open went stale just as the table had (#1177). Rather than a second copy of the table's clock, a small `minuteClock()` in `tickets/` now ticks each minute for both, stopping with its component, and the table's own copy is gone. And a message someone else wrote appeared with the arrival tone, but the list was not a live region, so a screen reader said nothing; it is now a polite one, and as messages are tracked by ID only the new ones are added and read. A spec failed first for each.

### [`helpdesk/src/app/tickets/open-ticket.ts`](https://github.com/Terrence721/platform-main/blob/5b8e937/projects/helpdesk/src/app/tickets/open-ticket.ts)

**Low · Usability** — 1 fix ([issue #1182](https://github.com/Terrence721/platform-main/issues/1182))

Opens the ticket popup for the agent's and the supervisor's pages, fetching its code and Material's dialogs on the first open only, with the ticket as its data, sized to fit narrow screens; both pages' specs open it from a subject, and the e2e tests open it and reply. The gap: the first time, the popup's code is still on its way when a second click or Enter comes, and with no backdrop yet to stop it, both opens finished and two copies of the same popup stacked up. The sign-in launcher guards against just this; now the ticket popup has an ID for its ticket, and is opened only if none with that ID is open, which the second open, coming after the first has opened, finds. The file had no spec of its own: a new one failed first, two opens at once giving two popups, and the two page specs' stand-in dialog learned to answer that question.

### [`helpdesk/src/app/agent/my-tickets.store.ts`](https://github.com/Terrence721/platform-main/blob/0a31d38/projects/helpdesk/src/app/agent/my-tickets.store.ts)

**Low · Correctness** — 1 fix; **Low · Documentation** — 1 fix ([issue #1184](https://github.com/Terrence721/platform-main/issues/1184))

The agent page's store. It holds, under its spec: My tickets, Unassigned and Done, each loaded when the page opens, in the API's order, with its own loading and failed state; taking a ticket and changing a status, a second while one is saving ignored, a refusal keeping the API's message or a fallback; a quiet refresh of all three on a live ticket event or a reconnect, keeping what is shown if it fails; and the arrival tone for a ticket someone else gave the agent, not one they are taking.

The gap: after a take or a status change, both lists were re-read in the same step as the change, so if a re-read failed the whole step was "failed", with "isn't available right now", though the ticket had been taken or changed; a retry would then be refused by the API. The outcome now comes from the change alone, and the lists are refreshed with the same quiet `refresh()` the live updates use, which keeps what is shown if it fails. A spec for each failed first. And `MY_TICKETS_API`'s comment said "through the dev server's proxy"; the app calls its own origin, whatever serves it. Noted, not changed: the tone is skipped for a ticket given back to an agent who once took it themselves.

### [`helpdesk/src/app/agent/agent.page.ts`](https://github.com/Terrence721/platform-main/blob/8365add/projects/helpdesk/src/app/agent/agent.page.ts)

**Low · Test coverage** — 1 fix; **Low · Documentation** — 1 fix ([issue #1186](https://github.com/Terrence721/platform-main/issues/1186))

The agent's page. It holds, under its spec: My tickets, Unassigned and Done (24 h), each with a spinner, an empty message and a failure read out with Try again; a take sent with the agent's own ID, "#N is yours" with a chime, a refusal keeping the API's message with a low tone; a status change from each row's menu, the chime for finished work only, a resolved ticket reopened from Done; subjects in My tickets and Done opening the popup, Unassigned's kept as plain text; and the snack bar's code loaded when first needed.

Two small gaps. Done's failure and its Try again had no spec, unlike the other two lists; one now covers it, passing as the code was right. And a line of the class comment ran to about 120 characters; it is rewrapped. Noted, not changed: while a take or a change is saving, a click on another row is ignored silently, for a split second, and the table can only hide a row's button, not disable it; the outcome effects are repeated in the supervisor page, for its review. The review covers `8365add`, the file's last change (#1153), not the `959a519` the plan named.

### [`helpdesk/src/app/supervisor/my-team.store.ts`](https://github.com/Terrence721/platform-main/blob/d51b960/projects/helpdesk/src/app/supervisor/my-team.store.ts)

**Low · Correctness** — 1 fix; **Low · Documentation** — 1 fix ([issue #1188](https://github.com/Terrence721/platform-main/issues/1188))

The supervisor page's store. It holds, under its spec: the team loaded when the page opens, a 404 read as no team rather than a failure; the chosen member's tickets, a new choice cancelling a load still running; assigning and changing a status, a second while one is saving ignored, a refusal keeping the API's message or a fallback; and a quiet refresh on a live update, skipping replies, dropping a member who left, leaving alone a member chosen while it ran, and keeping what is shown if it fails.

The gap was the agent store's (#1185), and one more. After an assignment or a status change, `refreshAfter` re-read the team and the member's tickets in the same step, so a failed re-read made the outcome "failed" though the ticket had been assigned or changed. And it took the chosen member when the change answered: a member chosen while the re-read ran was shown the earlier member's tickets, and one who had left the team was not handled. The store's own `refresh()` already did all this right; the outcome now comes from the change alone, then that refresh runs, and `refreshAfter` is gone. Three specs failed first. And `MY_TEAM_API`'s comment said "through the dev server's proxy"; it now says the app's own origin.

### [`helpdesk/src/app/supervisor/assign-ticket.dialog.ts`](https://github.com/Terrence721/platform-main/blob/93a8e18/projects/helpdesk/src/app/supervisor/assign-ticket.dialog.ts)

**Low · Usability** — 1 fix ([issue #1190](https://github.com/Terrence721/platform-main/issues/1190))

The "Assign to…" popup, which only chooses: it closes with the agent's ID, and the page assigns. It holds, under its spec: the ticket and its subject named; each agent with their open and overdue work, the holder marked "(has it now)" and not selectable; every agent selectable for an unassigned ticket; and Assign waiting for a choice.

The gap: the team lists only its active agents (#1027), so a team can have nobody to give a ticket to, none at all or only its holder, and the popup then showed an empty or wholly disabled list with an Assign that never enabled, and no word why. It now says "No other agent on your team can take it." Specs for both cases failed first, once they compared with the sentence itself: written against a constant not yet exported, they had passed, `undefined` against `undefined`. Noted, not changed: the load counts are those of when the popup opened, and an agent who left meanwhile is refused by the API, which the page reports; and the disabled holder is skipped by the arrow keys, so a screen reader doesn't hear "(has it now)", though the page's row shows the holder.

### [`helpdesk/src/app/supervisor/member-history.dialog.ts`](https://github.com/Terrence721/platform-main/blob/5a9b084/projects/helpdesk/src/app/supervisor/member-history.dialog.ts)

**No findings** ([issue #1192](https://github.com/Terrence721/platform-main/issues/1192))

A team member's last three months, for their supervisor. It holds, under its spec: the history loaded fresh, once, each time the popup opens, from a small store that lives with it; user IDs safe in the address; the period with its start, then Assigned, Finished, Open, On time and Late, in order, with a note on how on time and late are judged that matches the contract (#1020); a message for a period with no tickets; a failure read out with Try again; and closing with its button or Esc. Its "Last 3 months" matches the server's `HISTORY_MONTHS`. Noted, not changed: that "3 months" is written twice in the app, as the server's constant lives where the app can't import it, but the period line shows the real start, so a drift would show; the history doesn't update live while open, a three-month look-back that reopening loads fresh; and Late is red even at 0, a styling choice.

### [`helpdesk/src/app/supervisor/supervisor.page.ts`](https://github.com/Terrence721/platform-main/blob/8365add/projects/helpdesk/src/app/supervisor/supervisor.page.ts)

**Low · Usability** — 1 fix; **Low · Maintainability** — 1 fix; **Low · Documentation** — 1 fix ([issue #1194](https://github.com/Terrence721/platform-main/issues/1194))

The supervisor's page. It holds, under its spec: the team's loading, failed and no-team states, with no Reports without a team; the member picker with each agent's load, None hiding their tickets again; the member's tickets with their own spinner, failure and empty message, Reassign on open work only; Assign on every unassigned ticket, "Assign to…" given the holder and the team, a cancel assigning nothing; a snack bar and a sound for each outcome, the chime for finished work only; and Reports on the chosen agent, else the team.

Three small gaps. The first time, a second click on Assign, Reassign or a member's name, while the popup's code was on its way and no backdrop was up, opened a second copy, as the ticket popup did before #1183; "Assign to…" and the history now have an ID per ticket or member and open only if none with it is open, and two specs failed first, against a stand-in dialog that now remembers what it opened. A local `OPEN_WORK` was one more copy of which statuses are open work after #1153; Reassign now shows for `!isFinished(status)`. And `report()`'s comment named only assignments. Noted, not changed: the outcome effects closely repeat the agent page's, two short copies with different messages; and the Reports popup's opener has the same double-click gap, for its own review.

### [`helpdesk/src/app/admin/team-accounts.store.ts`](https://github.com/Terrence721/platform-main/blob/ae549ee/projects/helpdesk/src/app/admin/team-accounts.store.ts)

**Low · Simplification** — 1 fix; **Low · Documentation** — 2 fixes ([issue #1196](https://github.com/Terrence721/platform-main/issues/1196))

The admin page's store. It holds, under its spec: every account loaded when the page opens, in the API's order; a created account joining in name order, a second send while saving ignored; an edit changing the account in place, its outcome from the `PUT` alone, then a quiet reload that keeps the edit if it fails; a refusal keeping the API's message for 400, 404 and 409, else a fallback; and a live refresh for account events and reconnects only.

After a saved edit, `update` re-fetched the list with its own `GET`, apart from the store's `refresh()`, so a live refresh at the same moment didn't replace it and the two raced; it now calls that refresh, shared by both, and the two existing reload specs cover it. The review first proposed swapping `refusalMessage` for the shared `apiErrorMessage`, whose only difference is 403; but here the only 403 is the role guard's bare "Forbidden", which the fallback beats, so the helper stays and its comment now says why. And `TEAM_ACCOUNTS_API`'s comment said "through the dev server's proxy"; it now says the app's own origin. Noted, not changed: a new account is placed with `localeCompare` while the API sorts by the database's collation, a rare difference that the next reload settles.

### [`helpdesk/src/app/admin/accounts-table.ts`](https://github.com/Terrence721/platform-main/blob/1324e3f/projects/helpdesk/src/app/admin/accounts-table.ts)

**Low · Usability** — 1 fix; **Low · Documentation** — 1 fix ([issue #1203](https://github.com/Terrence721/platform-main/issues/1203))

The Team accounts table. It holds, under its spec: the columns in the order given; a pill per role, admins their own, the team's lead reading "Supervisor · Lead" and a replaced supervisor not; inactive accounts marked; Edit on every row but the signed-in admin's own, named for its account and not sortable; and each header sorting, reversing, then returning to the order given, active accounts before inactive.

Role sorted every supervisor alike, so with a replaced supervisor on the team, a real case the spec already builds, the lead's place among them was the API's order, and the spec's "team lead first" held only for a team with one supervisor. Role now sorts as roles are shown, a lead just after the other supervisors; a spec with the replaced supervisor listed first failed first. And the pill styles' comment, with a spec's name, said "team leads green, members blue", where green is every supervisor and blue the agents. Noted, not changed: Name sorts by lowercase character code, Material's default, so an accented name would sort after "z"; the seeded names are plain ASCII.

### [`helpdesk/src/app/admin/create-account.dialog.ts`](https://github.com/Terrence721/platform-main/blob/207f732/projects/helpdesk/src/app/admin/create-account.dialog.ts)

**Low · Correctness** — 1 fix ([issue #1205](https://github.com/Terrence721/platform-main/issues/1205))

The Create Account popup. It holds, under its spec: every field checked against the contract before anything is sent, the user ID message matching `USER_ID_PATTERN`; a blank name refused and a good one trimmed; an admin given no team and sending none; a new supervisor warned of the lead they'd replace, and no warning otherwise; the password shown or hidden with `aria-pressed`; and the API's refusal read out, one save at a time, the store reset as the popup opens.

The gap: it closed with whatever the User ID field said when the save finished, and as the fields stay editable while saving, typing then made the page's snack bar name an account that wasn't created. It now closes with the user ID it sent; a spec that changes the field during the save failed first. Noted, not changed: a double click on the page's Create account button can open two popups, as #1183 and #1195 closed elsewhere, for the admin page's review.

### [`helpdesk/src/app/admin/edit-account.dialog.ts`](https://github.com/Terrence721/platform-main/blob/786491a/projects/helpdesk/src/app/admin/edit-account.dialog.ts)

**Low · Correctness** — 1 fix ([issue #1207](https://github.com/Terrence721/platform-main/issues/1207))

The Edit account popup, whose warnings say what else a change does; each was checked against the server's `UsersService.update`. It holds, under its spec: the account shown as it is, Save off until something changes; open tickets going back to Unassigned when the account stops being an active agent on its team, as the server releases them; a team left with no lead when its lead is deactivated, stops being a supervisor or moves, as the server's `stillLeads`; an admin sending no team, and one made an agent asked for a team; and the API's refusal read out, one save at a time, closing once saved.

The gap: the server makes a supervisor the lead only when they are new to the role or to the team, but the popup warned "X leads the team now… this account will lead it" for any active supervisor on a team who didn't already lead it. A replaced supervisor, a real case, saw that warning as soon as the popup opened, and saving changed no lead. The warning now follows the server's rule; a spec for a replaced supervisor staying put failed first, and another keeps the warning for one moved to a team with a lead.

### [`helpdesk/src/app/admin/admin.page.ts`](https://github.com/Terrence721/platform-main/blob/1324e3f/projects/helpdesk/src/app/admin/admin.page.ts)

**Low · Usability** — 1 fix; **Low · Documentation** — 1 fix ([issue #1209](https://github.com/Terrence721/platform-main/issues/1209))

The admin's Team accounts page. It holds, under its spec: teams by name, each keeping the API's order, admins in a section of their own after them; the summary's counts pluralized, and "No lead" only beside a team without one; no Edit on the admin's own row; loading, failure and Try again; and Create Account and Edit opened with the page's injector, so they save through its store, their snack bars naming what was done, a cancel saying nothing.

The first time, a second click on Create Account or Edit, while the popup's code was on its way and no backdrop was up, opened a second copy, as on the ticket popup (#1183) and the supervisor page (#1195); each popup now has an ID and opens only if none with it is open, and two specs failed first. And the class comment called the green pills team leads, where they are every supervisor (#1204). Noted, not changed, and filed as #1210: the page builds its teams from the accounts on them, so a team emptied of accounts vanishes from the page and from both popups' team lists, with no way back from the app; that needs the API to list the teams. The Reports button's double-click gap belongs to `open-reports.ts`.

### [`helpdesk/src/app/reports/reports.store.ts`](https://github.com/Terrence721/platform-main/blob/9b2b8ea/projects/helpdesk/src/app/reports/reports.store.ts)

**Low · Correctness** — 1 fix; **Low · Documentation** — 1 fix ([issue #1212](https://github.com/Terrence721/platform-main/issues/1212))

The Reports popup's store. It holds, under its spec: the figures loaded on opening, for the pick given or the caller's own default; a failed first load said, and Try again showing loading; a refresh keeping the figures shown until the new ones come, and when it fails; a newer load replacing one still running, so picking someone never shows an older answer, the figures going and the choices staying; the summary summed from the team rows, or an agent's own row; and the team or agent query from the contract's constants.

SLA met % was rounded to the nearest percent, so 995 tickets on time of 1,000 read 100%, a claim that every one was; it now rounds down, in the one function every SLA figure in the app goes through. Specs for 995 of 1,000 and 199 of 200 failed first, three expectations of 2 of 3 moved from 67% to 66%, and the spec's titles, written with `%%`, which Vitest printed as "66% undefined", now say "percent". And `REPORTS_API`'s comment was the fourth to say "through the dev server's proxy". Noted, for the popup's review: a failed refresh is silent, as the old figures stay and nothing says so.

### [`helpdesk/src/app/reports/reports.dialog.ts`](https://github.com/Terrence721/platform-main/blob/3c07d05/projects/helpdesk/src/app/reports/reports.dialog.ts)

**Low · Usability** — 1 fix; **Low · Maintainability** — 1 fix ([issue #1214](https://github.com/Terrence721/platform-main/issues/1214))

The Reports popup. It holds, under its spec: a spinner, a failure with Try again, and Refresh keeping the charts up while its icon spins; Report for offering a supervisor their team then its agents, and an admin every team with its lead then the agents by team, a pick switching the report and scrolling to its top, with `pickValue` and `pickFrom` keeping IDs that hold a colon; the scope line naming the team or agent and the window's start; the tiles; and charts in the page's theme colors, a gap where nothing was due rather than a zero, empty donut slices kept in the legend only, each described to screen readers. ECharts comes with the popup, with only the parts these charts use.

Two gaps. A failed refresh was silent: the old figures stayed and the icon stopped, as if they were current. The store now keeps `refreshFailed`, set by a failed refresh and cleared by the next load, and the popup says "Couldn't refresh. These are the figures from before."; a spec in each file failed first. And "last 30 days" was written five times, in the headings and the Finished tile, while the contract has `REPORT_WINDOW_DAYS`, which the server uses; they now take it from there. Noted, not changed: the agents' "SLA met and median hours" chart puts percent and hours on two y-axes in one chart, which is easy to misread, a design change left as it is; and theme colors are read when a chart is built, so an OS theme switch while the popup is open shows until the next refresh.

### [`helpdesk/src/app/reports/open-reports.ts`](https://github.com/Terrence721/platform-main/blob/9b2b8ea/projects/helpdesk/src/app/reports/open-reports.ts)

**Low · Usability** — 1 fix ([issue #1216](https://github.com/Terrence721/platform-main/issues/1216))

Opens the Reports popup for the supervisor's and the admin's pages. It holds, under its spec: the popup's code fetched on the first click, ECharts only when it draws; a popup 72rem wide, never wider than the screen; and a pick, such as the agent chosen in Team member, handed to the popup's store through a child injector, the default without one. Its `autoFocus: false` was checked against the CDK, which treats `false` as `'dialog'`: focus goes to the popup itself, which is announced, rather than to Refresh.

The gap, noted at the supervisor page (#1195) and the admin page (#1211): the first time, a second click while the popup's code was on its way, with no backdrop yet to stop it, opened a second Reports popup. It now has an ID and opens only if none with it is open, as the ticket, assign, history, Create Account and Edit popups do; a spec with two opens at once failed first. That closes the double-click gap on every popup in the app.

### [`helpdesk/src/app/landing/capability.ts`](https://github.com/Terrence721/platform-main/blob/a169d2d/projects/helpdesk/src/app/landing/capability.ts)

**Medium · Correctness** — 1 fix ([issue #1218](https://github.com/Terrence721/platform-main/issues/1218), part of [#1024](https://github.com/Terrence721/platform-main/issues/1024))

The landing page's six feature cards, served through @ngrx/data, each with its own id. Each card was checked against the running app: Clear ownership and Live updates hold; the rest promised more than the app does, on the public page and in the live demo beside it, where a visitor can compare.

Tickets and queues offered queues, filters and search, and no screen shows a ticket's queue and no list has filters or search (each ticket does carry a queue in the contract and the database, as this entry first said it didn't: corrected in #1230's review); Replies and internal notes offered canned replies; Admin in the same app had admins managing queues, customers and canned replies, where they manage accounts, and see Reports; and Deadlines had nearly-due work standing out, where overdue work is marked and lists put the most urgent first, but nothing marks "nearly due". The cards now say what the app does: Tickets and priorities, Replies and internal notes, Accounts and reports in the same app, and Deadlines without "nearly-due". A spec fails any card naming queues, filters, search, canned replies or nearly-due work, and four failed it first. #1024 stays open for the hero, in `landing.page.ts`.

### [`helpdesk/src/app/landing/features.ts`](https://github.com/Terrence721/platform-main/blob/a169d2d/projects/helpdesk/src/app/landing/features.ts)

**Low · Correctness** — 1 fix ([issue #1220](https://github.com/Terrence721/platform-main/issues/1220), part of [#1024](https://github.com/Terrence721/platform-main/issues/1024))

The landing page's features section. It holds, under its spec: the capabilities asked for when it is created and shown as cards in order, from @ngrx/data's cache; a list, so a screen reader can count them; an `h2` with the id the page labels the section by, an `h3` per card, and the icons hidden from screen readers. Three columns become one on a narrow screen.

Its intro promised too much, as the cards did: "fast lists, clear deadlines, and no ticket left without an owner", where the app keeps an Unassigned list by design and nothing measures how fast a list is. It now reads "clear deadlines, the most urgent work first, and the tickets nobody holds yet in plain view"; a spec on it failed first. Noted, not changed: the file is `features.ts` while the component is `CapabilitiesSection`, a mismatch not worth a rename.

### [`helpdesk/src/app/landing/capabilities.data-service.ts`](https://github.com/Terrence721/platform-main/blob/a169d2d/projects/helpdesk/src/app/landing/capabilities.data-service.ts)

**Low · Maintainability** — 1 fix ([issue #1224](https://github.com/Terrence721/platform-main/issues/1224))

Serves the landing page's capabilities to @ngrx/data from the app itself, in place of the HTTP default, registered for the `Capability` entity in the landing route's providers. It holds, under its spec: `getAll` serving every capability with no request, fresh copies on each subscription so the store never holds the shared constant, and a name after the entity; and the section only ever calls `getAll`.

It extended `DefaultDataService` and overrode `getAll` alone, under a comment that only reading was served. But `getById` and `getWithQuery` are reads too, and they and every write fell through to the inherited HTTP methods, asking a `/api/capability…` that doesn't exist, which would fail with a 404 rather than say why; and `HttpClient` and `HttpUrlGenerator` were injected only to satisfy the base class. The class now implements `EntityCollectionDataService<Capability>` instead, composition over inheritance as in the repo's own redesign: `getAll` is unchanged, the other six return a failing Observable saying capabilities are read-only and only `getAll` is supported, which @ngrx/data reports as an error action, and no HTTP dependency remains. Specs for the six failed first, each waiting a minute on a request nobody answered.

### [`helpdesk/src/app/landing/capabilities.service.ts`](https://github.com/Terrence721/platform-main/blob/a169d2d/projects/helpdesk/src/app/landing/capabilities.service.ts)

**No findings** ([issue #1226](https://github.com/Terrence721/platform-main/issues/1226))

The capabilities' @ngrx/data entity collection service. It holds, under its spec: no capabilities and not loading at first; `load()` bringing all six, in order, through the app's own data service; and loading only while they are on their way. Its comment matches: the section uses `load()` and `entities$`. Noted, not changed: it is an empty subclass of `EntityCollectionServiceBase`, and @ngrx/data's factory would give the same service without a class, closer to the composition taken in #1225; but extending this base is the library's documented way to a typed, injectable collection service, and unlike `DefaultDataService` it brings nothing unwanted.

### [`helpdesk/src/app/landing/landing.actions.ts`](https://github.com/Terrence721/platform-main/blob/8dcdfdf/projects/helpdesk/src/app/landing/landing.actions.ts)

**Low · Maintainability** — 1 finding, fixed with the next file; **Low · Consistency** — 1 fix ([issue #1228](https://github.com/Terrence721/platform-main/issues/1228))

The landing page's two action groups: the showcase tickets' API results, and what the visitor does. Both comments hold: a failed load's `error` reaches the visitor through the app's `showErrors` effect, which shows any action with a string `error`; and the page dispatches `Opened` as it is created, the tickets loading in response.

`Status Filter Changed` is dispatched by nothing but specs: the page has no status filter, though a `statusFilter` field, a reducer case and a `selectStatusFilter` selector in `landing.feature.ts` stand behind it, a planned feature never wired. It is to go, action and state together, in that file's review, as removing the action alone would break the reducer. And the contract's types were imported as values; they are now `import type`, as #1167 made `sign-in.actions.ts`.

### [`helpdesk/src/app/landing/landing.feature.ts`](https://github.com/Terrence721/platform-main/blob/8dcdfdf/projects/helpdesk/src/app/landing/landing.feature.ts)

**Low · Maintainability** — 1 fix; **Low · Consistency** — 1 fix ([issue #1230](https://github.com/Terrence721/platform-main/issues/1230))

The landing page's NgRx feature: the showcase tickets in an entity adapter and their load state. It holds, under its spec: `compareBySlaDue` putting the earliest due time first and tickets without an SLA last, ties broken by number, ISO times compared as text; loaded tickets stored in that order, a reload replacing them; and a failed load marked while the tickets it had are kept.

The status filter that `landing.actions.ts`'s review found unwired goes, as agreed there: the action, the `statusFilter` field, its reducer case and `selectVisibleTickets`, the preview store now reading `selectAllTickets`, which is the same list without a filter. A spec of the state, holding only the tickets and their load, failed first; the filter's own specs go, and the effects spec's "other action" is now a loaded result. The types are `import type`. This review also found that `capability.ts`'s entry, above, said the ticket contract has no queues: it has (`TicketDto.queue`), though no screen shows them, which is what the card change rests on; that entry is corrected and #1218 says so.

### [`helpdesk/src/app/landing/landing.effects.ts`](https://github.com/Terrence721/platform-main/blob/8dcdfdf/projects/helpdesk/src/app/landing/landing.effects.ts)

**No findings** ([issue #1232](https://github.com/Terrence721/platform-main/issues/1232))

The effect that loads the showcase tickets when the landing page opens. It holds, under its spec: a load on "opened" and nothing else; a failure turned into an action with words a visitor can read; the effect still working after one; and a repeat "opened" ignored while a load runs. Noted, not changed: a failure would be reported twice in the same words, inline by the preview and in a snack bar by the app's `showErrors`, and the sentence is written in both files; the tickets are built in the browser today and cannot fail, so one or the other is worth choosing when the load becomes an HTTP call.

### [`helpdesk/src/app/landing/showcase-tickets.ts`](https://github.com/Terrence721/platform-main/blob/8dcdfdf/projects/helpdesk/src/app/landing/showcase-tickets.ts)

**Low · Consistency** — 1 fix ([issue #1234](https://github.com/Terrence721/platform-main/issues/1234))

The four example tickets the landing page's "My tickets" preview shows, shaped as the API's `TicketDto`. It holds, under its spec: times relative to the moment the page opens, so the overdue ticket stays overdue whenever it is opened; the same four as the database seed's showcase tickets, field by field; each with its own id and number, all one agent's. Nothing in their text promises what the app lacks. `TicketDto` is now `import type`, as in the last two files. Noted, not changed: `MINUTE` is also exported by `tickets/minute-clock.ts`, but importing it would tie the landing data to the ticket screens for one obvious number.

### [`helpdesk/src/app/landing/showcase-tickets.service.ts`](https://github.com/Terrence721/platform-main/blob/8dcdfdf/projects/helpdesk/src/app/landing/showcase-tickets.service.ts)

**Low · Documentation** — 1 fix; **Low · Consistency** — 1 fix ([issue #1236](https://github.com/Terrence721/platform-main/issues/1236))

Where the landing page gets its showcase tickets. It holds, under its spec: `load()` giving the four, timed when subscribed to rather than when called. Its comment said the only part to change "when the API exists" was `load()`; the API has long existed, and what it lacks is a public endpoint for these tickets, as every ticket route needs a signed-in user. The comment now says so, and that the tickets are built in the browser. `TicketDto` is now `import type`.

### [`helpdesk/src/app/landing/ticket-preview.store.ts`](https://github.com/Terrence721/platform-main/blob/e96d725/projects/helpdesk/src/app/landing/ticket-preview.store.ts)

**Low · Maintainability** — 1 fix; **Low · Consistency** — 1 fix ([issue #1238](https://github.com/Terrence721/platform-main/issues/1238))

The landing page's "My tickets" preview card's ComponentStore. It holds, under its spec: each row's SLA label at the current time, kept current once a minute; one row open at a time, a second click closing it; the clock stopping with the card; and `slaLabel` itself, "No SLA", "Overdue 25m", "Due in 2h 15m", "soon" within four hours.

That `slaLabel` was the gap: the signed-in app's ticket table and ticket popup imported it from this landing-page store, so the core ticket screens depended on the marketing preview, and the helper was hard to find. It moves unchanged to `tickets/sla-label.ts`, beside `minute-clock.ts`, whose `MINUTE` it now uses, and its nine specs move with it, passing as they were; the store, the table and the popup import it from there. `TicketDto` is now `import type`. Noted, for its own review: `STATUS_GUIDE` has the same wrong-way dependency, imported from `ticket-workflow.store.ts` by the table, the popup and the agent and supervisor pages.

### [`helpdesk/src/app/landing/ticket-preview.ts`](https://github.com/Terrence721/platform-main/blob/94ebcf2/projects/helpdesk/src/app/landing/ticket-preview.ts)

**Low · Accessibility** — 1 fix; **Low · Correctness** — 2 fixes ([issue #1240](https://github.com/Terrence721/platform-main/issues/1240))

The landing page's "My tickets" card. It holds, under its spec: the tickets in the store's order, their SLA labels colored by urgency and kept current; loading and failure messages; and subjects as buttons that open a ticket's description, with `aria-expanded` and `aria-controls`. Its fixed SLA colors are readable, the app having only the light `azure-blue` theme.

Three small gaps. The card carried `aria-labelledby` but no role, and a name on a generic element never reaches a screen reader; it is now a region, which its heading names. It showed each ticket's queue, which the app's own ticket table never shows, the preview promising a column the product lacks; the queue is gone, and what stays is what the table shows. And its count read "Example data · 0 tickets" beside "Loading…" or the failure message; it now shows only once the tickets have loaded. Specs for each failed first.

### [`helpdesk/src/app/landing/ticket-workflow.store.ts`](https://github.com/Terrence721/platform-main/blob/2352579/projects/helpdesk/src/app/landing/ticket-workflow.store.ts)

**Medium · Correctness** — 1 fix; **Low · Maintainability** — 1 fix; **Low · Consistency** — 1 fix ([issue #1242](https://github.com/Terrence721/platform-main/issues/1242), part of [#1024](https://github.com/Terrence721/platform-main/issues/1024))

The landing page's "How a ticket moves" store, and `STATUS_GUIDE`, each status's label, icon and meaning. It holds, under its spec: where a ticket can go from the picked status, from the contract's `canTransition`, so the section shows exactly what the API allows; every status in order, from New, only the picked one picked; and Closed final. Open's, Resolved's and Closed's meanings are true.

Two meanings, on the public page, were not. New had "Just arrived from a customer's email", and there is no email intake; Pending had "Their reply moves the ticket back to open", where customers don't reply in the app and nothing reopens a ticket by itself. They now read "Just raised. Nobody has picked it up yet." and "Waiting on the customer. Whoever holds it moves it back to open when they hear back."; a spec that no meaning promises either failed first, on those two. And as with `slaLabel` (#1239), the ticket table, the ticket popup and both pages imported `STATUS_GUIDE` from this landing store, only for its labels: a new `tickets/status-labels.ts`, with its spec, now names each status for them, and `STATUS_GUIDE` takes its labels from it, a spec checking they agree. With that, no file outside `landing/` imports landing code. `TicketStatus` is `import type`.

### [`helpdesk/src/app/landing/ticket-workflow.ts`](https://github.com/Terrence721/platform-main/blob/79e193c/projects/helpdesk/src/app/landing/ticket-workflow.ts)

**No findings** ([issue #1244](https://github.com/Terrence721/platform-main/issues/1244))

The landing page's "How a ticket moves" section. It holds, under its spec: the statuses in order with New picked at first, where a ticket can go highlighted and spelled out, the picked status followed and kept when clicked again, and Closed final with nothing highlighted; a labelled listbox, its arrows hidden from screen readers, and the explanation a polite live region. Its copy, with the meanings fixed in the store's review, promises nothing the app lacks. Noted, not changed: the intro says "Five statuses" in text while the chips come from the contract, which a new status would need this page reviewed for anyway.

### [`helpdesk/src/app/landing/roles-table.ts`](https://github.com/Terrence721/platform-main/blob/0f370e6/projects/helpdesk/src/app/landing/roles-table.ts)

**Low · Accessibility** — 1 fix; **Low · Consistency** — 1 fix ([issue #1246](https://github.com/Terrence721/platform-main/issues/1246))

The landing page's "Three roles, clear limits" table. It holds, under its spec: a column for the ability, then one per role; every cell from the contract's `ROLE_PERMISSIONS`, every permission in exactly one row, so the page cannot promise more than the API allows; the checks and dashes hidden, a screen reader hearing Yes or No; and an `h2` the page labels the section by. Each row, trimmed in #1023, says only what the app does.

Each row's ability was a plain `<td>`, so a screen reader moving along a row heard only Yes or No, with nothing to say which ability it was about; it is now a row header, `<th scope="row">`, styled as the plain cell it was. A spec failed first. `Permission` and `Role` are `import type`. Noted, not changed: the table leaves out Reports, which supervisors and admins have, as it is not a contract permission; it undersells slightly, and adding it would be a contract change.

### [`helpdesk/src/app/landing/sign-in-cta.ts`](https://github.com/Terrence721/platform-main/blob/41acb57/projects/helpdesk/src/app/landing/sign-in-cta.ts)

**No findings** ([issue #1248](https://github.com/Terrence721/platform-main/issues/1248))

The landing page's closing band: "Ready to pick up the next ticket?" and a Sign in button. It holds, under its spec: an `h2` the page labels the band by, and a button that opens the sign-in popup through the shared `SignInLauncher`, one popup per click. Its icon is hidden from screen readers, as `mat-icon` is by default, and its line, "Sign in with the account your admin set up for you", is true: admins create the accounts.

### [`helpdesk/src/app/landing/landing.page.ts`](https://github.com/Terrence721/platform-main/blob/cc57755/projects/helpdesk/src/app/landing/landing.page.ts)

**Medium · Correctness** — 1 fix; **Medium · Maintainability** — 1 fix ([issue #1250](https://github.com/Terrence721/platform-main/issues/1250); closes [#1024](https://github.com/Terrence721/platform-main/issues/1024))

The public product page. It holds, under its spec: each section named by its heading, and one for every toolbar link; "See what it does" leading down to the features; a hero photo with `srcset`, sizes, width and height and a description; and Sign in once on the page, in the closing band.

Its lede was the last of #1024: "turns customer emails into tickets your team can sort into queues", with no email intake and no queues to sort into. It now reads "gives every customer request a ticket your team can assign and resolve before its deadline", and a spec with neither word failed first; with it #1024 is done.

The larger gap: the page dispatched `opened()`, loading the showcase tickets, but since the hero photo took the "My tickets" card's place on Oct 2 nothing rendered that card. The card, its store, the showcase tickets and their service, and the landing actions, feature and effects were off screen, and they were the app's only use of `@ngrx/component-store` and `@ngrx/entity`. The card now returns in a band of its own after the features, "A look at your day", introduced as what an agent sees after signing in, with example tickets; its heading becomes an `h3` under the band's, and the bands still alternate. A spec for the band failed first. This is also a miss in this audit: the reviews of `landing.actions.ts` through `ticket-preview.ts`, above, reviewed and changed that chain without first checking that its component was on screen. Their changes stand, and are live now; `slaLabel` and `STATUS_LABELS`, moved out along the way, were in use throughout.

### [`helpdesk/src/app/app.effects.ts`](https://github.com/Terrence721/platform-main/blob/41acb57/projects/helpdesk/src/app/app.effects.ts)

**Low · Documentation** — 1 fix ([issue #1252](https://github.com/Terrence721/platform-main/issues/1252))

The app-wide `showErrors` effect. It holds, under its spec: a snack bar with the message of any action whose `error` is a string, others ignored, one per error in order, nothing dispatched; and its snack bar code fetched with the first error rather than with the page. One action carries an `error` today, the landing page's "Showcase Tickets Load Failed"; sign-in's failure uses `message` on purpose, as its popup shows it. The type's example, `[Books API] Load Failure`, was from the project's books days; it is now the real one, and the comment says why a failure shown where it happened carries `message`. Noted, not changed: the landing failure is also shown inline by the preview card, as noted for the landing effects; it cannot happen while those tickets are built in the browser.

### [`helpdesk/src/app/app.routes.ts`](https://github.com/Terrence721/platform-main/blob/a8a2046/projects/helpdesk/src/app/app.routes.ts)

**Low · Usability** — 1 fix ([issue #1254](https://github.com/Terrence721/platform-main/issues/1254))

The app's top-level routes. It holds, under its spec: the landing page at `/`, its state and effects registered on its route and its showcase tickets loading, the capabilities served by the app with no request; each role's page at its address with its title; an agent opening `/admin` sent to their own page, and a signed-out visitor to the landing page with the sign-in popup open. Every page is lazy-loaded.

The gap, noted at the role guard's review: no route caught an address that matched nothing, so a typo or an old bookmark made the router throw and a first load showed an empty page under the toolbar. A last route, `{ path: '**', redirectTo: '' }`, now sends it to the landing page; a spec opening `/no-such-page` failed first with the router's error.

### [`helpdesk/src/app/app.config.ts`](https://github.com/Terrence721/platform-main/blob/4499c1c/projects/helpdesk/src/app/app.config.ts)

**Low · Documentation** — 1 fix; **Low · Maintainability** — 1 fix ([issue #1256](https://github.com/Terrence721/platform-main/issues/1256))

The app's providers, each piece tested where it lives and all of it started by the e2e tests. It holds: zoneless change detection; HTTP over `fetch` with the session-ended interceptor; the router, whose anchor links stop short of the sticky toolbar, measured each time as it is shorter on phones; router state in the store; the session feature and all seven session effects, listed by name as the module also exports constants and a helper; @ngrx/data for the capabilities; and the devtools, log-only outside development, with passwords hidden. Its comment had @ngrx/data's cache waiting for "admin data once there is some"; admin data came, in a signal store, so it now says the cache is for the capabilities. And `withFetch()`, spotted in the editor during the review, is deprecated in Angular 22.2, where fetch is the default backend; it goes, changing nothing (the demo backend's spec uses it too, for its own review). Noted, not changed: no spec would catch a new session effect left off the list, as NgRx has no public way to tell an effect from another export, but a missing core one would break the e2e sign-in journeys.

### [`helpdesk/src/app/app.component.ts`](https://github.com/Terrence721/platform-main/blob/959a519/projects/helpdesk/src/app/app.component.ts)

**Low · Accessibility** — 1 fix ([issue #1258](https://github.com/Terrence721/platform-main/issues/1258))

The app shell: the sticky toolbar and the routed page. It holds, under its spec: the logo leading home, to the landing page or a signed-in user's own page; the page keeping its own `h1`; signed out, the landing sections, the current one marked, and Sign in, neither shown until the start-up check answers; signed in, who it is, the sound toggle reporting its state, and Sign out; and on a narrow screen, signed out, only the logo and Sign in.

Signed in, a narrow screen had no rule, and jsdom has no layout to show it, so the toolbar was measured in Chromium on the demo build: its content ran to 463–496 px on 360 px and 412 px screens, and at 360 px Sign out was off the screen, reached only by scrolling the page sideways. Below 600 px the toolbar now leaves out who is signed in, which their own page says; measured again, it ends at 344 px of 360 and 396 of 412, though at 320 px it is still 14 px over. A new e2e test signs in as the supervisor, the longest name and role, at 360 px, and expects Sign out wholly on screen. The measuring also found the role pages' tables wider than a phone, scrolling the whole page sideways, for a follow-up.
