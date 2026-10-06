# Helpdesk Code Review Results

<!-- markdownlint-disable-next-line MD036 -->

**Last Updated: October 6, 2026** (`helpdesk-contract` in progress: 2 of 11 files)

> [!CAUTION]
> This is a simulation of real-world code review.

The Helpdesk app ([#303](https://github.com/Terrence721/platform-main/issues/303)) was built through one issue and pull request per feature, with tests and review on every one, but its finished files had never been audited one by one for defects. This audit does that, the same way the 13 modules were audited ([#32](https://github.com/Terrence721/platform-main/issues/32), findings in [`code-review.md`](code-review.md)). Its tracking issue is [#1001](https://github.com/Terrence721/platform-main/issues/1001), with one sub-issue per project.

**Scope: 121 files.** Every non-spec source file of the five Helpdesk projects, plus the files with real logic outside TypeScript: the SQL migrations, both `Dockerfile`s and the app's `nginx.conf`. Specs, ESLint configs, styles and tool configs are out of scope, as in #32.

| Order | Project             | Files | Tracking issue                                                    |
| ----- | ------------------- | ----- | ----------------------------------------------------------------- |
| 1     | `helpdesk-contract` | 11    | [#1002](https://github.com/Terrence721/platform-main/issues/1002) |
| 2     | `helpdesk-server`   | 21    | [#1003](https://github.com/Terrence721/platform-main/issues/1003) |
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

**Medium · Correctness** — 1 bug found (fixed separately in [#1009](https://github.com/Terrence721/platform-main/issues/1009)), 2 doc comments fixed ([issue #1010](https://github.com/Terrence721/platform-main/issues/1010))

The account types and constants. Every doc comment here promises server behavior, so each promise was traced to the code behind it rather than read on trust: the password hash never leaves the database (`selectAccounts` reads six columns only); a new account's user ID, name, password and team are checked as described, the name by both the Create popup and the API; your own account and the last active admin are protected.

The bug: changing an account hands its open tickets back only when it is "deactivated, moved to another team, or made an admin", and an agent made a supervisor of the same team is none of those. Supervisors don't work tickets, My team lists only agents, and reassigning accepts only tickets an agent holds, so the agent's open tickets are stranded. Reproduced against PGlite with the real migrations: after the change the ticket was still Sam's, in neither My team nor Unassigned, and both his old lead and Sam himself were refused when reassigning it ("No such ticket on your team."). The rule lives in the server, the edit popup's warning and this file, so the fix has its own issue and pull request ([#1009](https://github.com/Terrence721/platform-main/issues/1009)), as cross-file bugs did in #32.

Fixed here: released tickets go to the one shared Unassigned list every team works from, not "the team's" (two comments); and who becomes a team's lead needed two conditions it left out, that the account is active and that a supervisor moved to another team also becomes its lead.
