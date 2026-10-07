# Helpdesk Code Review Results

<!-- markdownlint-disable-next-line MD036 -->

**Last Updated: October 7, 2026** (`helpdesk-contract` complete: 11 of 11; `helpdesk-server` in progress: 19 of 23)

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

**Medium-low · Correctness** — 1 race filed ([#1085](https://github.com/Terrence721/platform-main/issues/1085)); **Low** — 1 duplicate removed ([issue #1086](https://github.com/Terrence721/platform-main/issues/1086))

Reading and changing tickets: the work lists, a member's history, taking, assigning, one ticket and status changes. Most of it holds. The lists and the history use the finish times of #1020; taking locks the ticket, so of two agents at once only the first gets it; assigning locks the ticket and keeps reassignment within the supervisor's team; reading one ticket and changing its status go through the shared access rule; and every change tells the live updates after it commits.

What is not locked is the agent. Assigning checks that the agent is active and on the team without locking their row, and taking does not check the agent inside its transaction at all, while an admin's edit hands back an agent's open tickets as it deactivates or moves them. Run at the same moment, the assignment can land after the hand-back, leaving an open ticket with an inactive agent: the stuck ticket of #1009 again. Locking the agent's row lets PostgreSQL put the two in order. The specs run on PGlite, with one connection, so the race cannot be shown there; how to test the fix is decided with it, as #1085.

Also here: `OPEN_WORK_STATUSES` was one more copy of the contract's list, which `teams.service` and `users.service` imported from this file; all three now use the contract's.
