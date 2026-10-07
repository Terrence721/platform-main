# Helpdesk Code Review Results

<!-- markdownlint-disable-next-line MD036 -->

**Last Updated: October 7, 2026** (`helpdesk-contract` complete: 11 of 11; `helpdesk-server` in progress: 3 of 22)

> [!CAUTION]
> This is a simulation of real-world code review.

The Helpdesk app ([#303](https://github.com/Terrence721/platform-main/issues/303)) was built through one issue and pull request per feature, with tests and review on every one, but its finished files had never been audited one by one for defects. This audit does that, the same way the 13 modules were audited ([#32](https://github.com/Terrence721/platform-main/issues/32), findings in [`code-review.md`](code-review.md)). Its tracking issue is [#1001](https://github.com/Terrence721/platform-main/issues/1001), with one sub-issue per project.

**Scope: 122 files.** Every non-spec source file of the five Helpdesk projects, plus the files with real logic outside TypeScript: the SQL migrations, both `Dockerfile`s and the app's `nginx.conf`. It began at 121; the fix for [#1020](https://github.com/Terrence721/platform-main/issues/1020) added a fourth migration, so `helpdesk-server` has 22. Specs, ESLint configs, styles and tool configs are out of scope, as in #32.

| Order | Project             | Files | Tracking issue                                                    |
| ----- | ------------------- | ----- | ----------------------------------------------------------------- |
| 1     | `helpdesk-contract` | 11    | [#1002](https://github.com/Terrence721/platform-main/issues/1002) |
| 2     | `helpdesk-server`   | 22    | [#1003](https://github.com/Terrence721/platform-main/issues/1003) |
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
