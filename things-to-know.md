# Things to Know

As-built constraints and decisions that are **invisible from the code alone** — why a window is
sized the way it is, which numbers are deliberately scoped differently from each other, what a
missing column forces the UI to do, what a query costs. One section per module.

**Read the relevant section before changing a module. Update it in the same PR when you change
behaviour it describes.** Terse and factual — not a changelog, not a design doc. When sources
disagree: `supabase/schema.md` (as-built DB) > this file (as-built behaviour) > `plan.md`
(original scope sketch).

---

## Accounts, roles & authentication

**Two sign-in paths, one per account, never both.** Google Workspace staff use OAuth; external
users (people outside the client's Workspace) are created by an admin at `/management/users` and
use email + password. There is no "external user who happens to have Google" — that was ruled
out explicitly, not overlooked.

**The OAuth callback must never delete an account that already has a `profiles` row.** Supabase
links a Google identity onto an existing account with the same confirmed email, so an external
user who clicks "Continue with Google" arrives in `auth/callback/route.ts` as *themselves*, with
a non-Workspace email. The pre-existing code deleted any non-Workspace user it saw
(`auth.admin.deleteUser`, cascading the profile) — correct while every account was internal, a
data-loss path the moment admin-created accounts exist. The profile lookup before that delete is
load-bearing; don't "simplify" it away.

**`resolveUserRole()` returns `viewer`, not null, for an account in no Google Group.** An
external user is in no group by definition, so any code path that reconciles roles must skip
them. Always go through `reconcileProfileRole()` (`lib/google/role-sync.ts`), never
`resolveUserRole()` directly — the nightly `group-sync` cron included, whenever it's built.
Calling it directly would promote every external user to `viewer`, which under the `0018` RLS
means the entire organisation's tasks and staff directory.

**Account type is fixed at creation and there is no conversion path.** `updateUser` refuses to
change an external user's role, and `userUpdateSchema` excludes `external` from the roles an
admin may assign. The reason is that role and authentication method are the same decision here:
an external account has a password and no Workspace identity, so promoting it would leave a
password-holder with internal access, and demoting a staff member to `external` would leave them
unable to sign in at all.

**`external` gets its own allow-set in `lib/permissions.ts`, written out in full.** It is
deliberately not derived from `VIEWER_ALLOWED`, even though it's currently a subset — the point
is that a future grant to `viewer` must not silently reach outside the company. Note the
direction of the containment: `external` sees *less* than `viewer` (only its own tasks), which
is also why `handle_new_user`'s `app_role` metadata hint can safely honour `external` and
nothing else — a forged hint can only lower privilege.

**The "Role Permissions" dialog on `/management/users` computes every cell by calling `can()`,**
not by re-listing the matrix. `constants/permission-catalog.ts` supplies only labels, grouping and
ordering, so a grant added in `lib/permissions.ts` shows up correctly with no edit here — a *new*
`Action` just goes unlisted until someone adds a row. The one entry carrying a `resource` is
`task.edit_due_date_when_locked`: without `{ isLocked: true }` that check answers "yes" for every
role, which is true but meaningless, since the action only bites once a task is actually locked.

**`profiles.status` was decorative before `0018`.** Nothing read it outside pickers, so
"deactivating" a user changed a badge. It is now enforced in **five** places that must stay
consistent — change one, check the rest:
1. `updateUser` bans the account in Supabase Auth (`ban_duration`), so no token is issued at all.
2. `password-form.tsx` maps a banned-user error to the deactivated message via the shared
   `isBannedError()` (`lib/auth-errors.ts`), checking both `error.code === "user_banned"` and a
   `.message` substring, and this reliably works for that flow.
   **The Google/PKCE flow (`auth/callback/route.ts`) never reliably surfaced the ban as a
   detectable error at all**, despite two attempts: first checking `exchangeCodeForSession`'s
   error, then also `getUser()`'s (the exchange can succeed — tokens minted — with the ban
   possibly enforced one call later, unlike `signInWithPassword`'s single-step rejection). Both
   real deactivated-account test logins (`cp.test1@`, `cp.test3@threebyone.com.au`, both confirmed
   genuinely banned via the GoTrue admin API) still fell through to the generic case, meaning
   whatever error Supabase actually returns here doesn't match `isBannedError()`'s code or message
   check at either point — the exact shape was never pinned down.
   **Current state is a deliberate workaround, not a fix**: `sign-in/page.tsx`'s `ERROR_MESSAGES`
   makes `"auth"` display the same text as `"deactivated"`, on the reasoning that a real "auth"
   hit is far more often a mis-detected ban than a genuine transient failure. This means a
   non-deactivated user hitting a real Google sign-in error also sees the deactivated/contact-
   support message, which is a real (accepted) regression in message accuracy for that rare case.
   If the exact Supabase error shape for this flow is ever captured (e.g. via Vercel function
   logs during a live repro), `isBannedError()`/the two checks in `callback/route.ts` should be
   corrected and this override in `sign-in/page.tsx` reverted to a real "something went wrong"
   message.
3. The profile.status check in `callback/route.ts` is a backstop for the pre-`0018` case where an
   account is inactive but never got banned, not the normal path.
4. `is_active_user()` in every task/participant/profile RLS policy.
5. `requirePermission()` in every Server Action, plus the `DeactivatedNotice` branch in
   `(app)/layout.tsx`.

**Why the ban AND the app-layer checks.** `profiles.status` is ours; Supabase Auth has never
heard of it, so status alone cannot stop a token being issued — only the ban does that. But
accounts deactivated before the ban existed aren't banned, so both sign-in routes keep their own
status check as a backstop. If the ban write fails, `updateUser` rolls the status back rather
than leaving a profile that says "inactive" next to an account that can still sign in.

**A session already open when someone is deactivated survives until its access token expires**
(~1h). It can read and write nothing — RLS and `requirePermission` see to that — but it is not
forcibly terminated. Banning blocks new tokens and refreshes, not tokens already issued.

**Why deactivation renders a notice instead of redirecting.** A deactivated user still holds a
valid session, so redirecting to `/auth/sign-in` gets bounced straight back to `/dashboard` by
`proxy.ts` — an infinite loop. The self-read leg of the `profiles` select policy
(`id = auth.uid()`, outside the `is_active_user()` gate) exists purely so the layout can read
its own row and tell "deactivated" from "signed out".

**Creating an auth user is the one sanctioned service-role call inside a Server Action.**
`supabase.auth.admin.createUser` has no per-user equivalent. `createExternalUser` gates on
`admin.manage_users` first, and deletes the auth user again if the follow-up profile write
fails, rather than leaving an account of indeterminate role behind.

---

## Google Calendar sync

**One-way, and that's a product rule, not an implementation detail.** Platform task → Google
Calendar. Nothing reads events back. `lib/google/calendar.ts` deliberately has no event
list/read function (it lists *calendars*, to find "Critical Path" — see below); if you find yourself adding one, that's the rule being broken, not a gap being filled.
`0011` originally pulled two ways — a Google event whose `updated` beat `google_synced_at`
overwrote the task's name and due date, which made anyone's phone a writer to org-wide data —
and cached every unrelated calendar event in `external_calendar_events` for display. Both were
removed in `0019`.

**`google_synced_at` no longer means what its name suggests.** It is the last time we *pushed*,
full stop. It is not compared against anything Google reports, because there is no conflict to
resolve when only one side writes.

**One task = one Google event, so joint ownership is first-claim-wins.** A task carries a single
`google_event_id`/`google_calendar_owner_id` pair, but owners are 1..n (34% of the client's rows
have two). Whoever syncs first claims the event; other owners skip that task rather than minting
a duplicate and orphaning the original — `syncGoogleCalendar` reports those as `skippedCount`.
If per-owner calendar copies are ever wanted, that's a `task_calendar_events(task_id, profile_id,
event_id)` table, not a tweak to these two columns.

**Event title/description are formatted, not a bare copy of `task_name`.** Client-requested:
title is `"<Season> - <Task Name>"` and the description is always two lines, `"OWNER: …"` /
`"PEOPLE INVOLVED: …"`, each a comma-joined list of party display names (department name, else
profile full name, else email — same precedence `task-parties.ts`'s `PartySummary` uses for the
in-app picker, reimplemented locally in `task-calendar-sync.ts` rather than shared, since this
only needs flat strings, not a full party shape). Both lines are always present even when a list
is empty (`"OWNER: "` with nothing after the colon) — a consistently-shaped description scans
better across many events than one that silently drops a line. Formatting lives in
`formatEventTitle`/`formatEventDescription` (`lib/google/task-calendar-sync.ts`), which is what
`pushTaskToGoogleCalendar` calls — the one shared push both the Sync button and `updateTask`'s
resync go through, so both paths format identically. Both call sites had to widen their
`tasks` select to join `season:seasons(season_name)` and `participants:task_participants(role,
profile:profiles(full_name, email), department:departments(name))` to have the data to format
with.

**Sync follows the Calendar's filters: what you see is what syncs.** The Sync button sends the
Calendar's active filters (Season, Brand, Status, Gender, Owner, People Involved, holiday
Country) to `syncGoogleCalendar`, which narrows the push through the same
`toTaskRangeFilters` + `listTasksByDueDateRange` pair the grid renders from (and
`listHolidaysByDateRange` for countries). The page and the action must keep sharing that pair,
or the two drift apart. Three rules are easy to break:
- **Filters narrow the push, never the removal pass.** A task filtered out of this sync keeps
  its Google event. Only leaving the user's scope (deleted, or removed from the task) removes
  one. Sync Season A and then Season B, and both stay on Google.
- **The date window stays fixed** (90 days back to 180 days ahead), whatever month is on screen.
  Filters narrow that window's tasks; the visible range does not.
- **A filtered sync asks first.** `calendar-sync-button.tsx` opens a confirm listing the active
  filters. With no filters it syncs straight away, as it always did.
Owner / People Involved options are the whole-organisation party list, so the page only loads
them for roles with `lookups.view`. External users get no options, and those two filters don't
render for them.

**Push scope is exactly the My Tasks scope, not just "owner".** `syncGoogleCalendar`
(`calendar/_actions.ts`) pushes every task this profile created, owns, or is People-Involved
on — named directly or through their department, via `task_participant_profiles`
(`taskIdsForProfile`) — the same union `resolvePersonalScope` (`data/tasks.ts`) uses for the My
Tasks page. It used to filter `task_participant_profiles` to `role = "owner"` only, which
silently dropped every "Involved" task and made it look like only self-created tasks synced (a
self-created task is nearly always also owner-participant, so that leg masked the bug). Not
`tasks.assignee_id` either — department-owned tasks are the overwhelming majority (832 of 833
rows), and `assignee_id` is null for all of them, so scoping by that superseded column would push
almost nothing.

**Sync also removes, not just pushes.** `syncGoogleCalendar` first scans every task whose
`google_calendar_owner_id` is the calling profile and that has since fallen out of their scope
(soft-deleted, or they were taken off it as owner/involved/creator), deletes that event via
`deleteCalendarEvent` (best-effort, same as `deleteTask`'s own cleanup), and clears
`google_event_id`/`google_calendar_owner_id`. This is necessary because the push is one-way and
event-driven only at task-delete time — removing someone from a task's participants
(`setTaskParticipants`) does **not** touch their calendar at all, so without this pass a task you
were taken off of would sit on your Google Calendar forever. Not windowed to `[from, to]` — scope
is the question here, not date range, and an already-synced event can carry any due date.

**Calendar eligibility is a property of the account, not of token presence.**
`isGoogleCalendarEligible()` requires a non-`external` role, `calendar.sync_google`, and a
Workspace email. Checking "is there a `google_oauth_tokens` row" instead would be wrong in both
directions: a token outlives a role change, and an absent token is indistinguishable from an
expired one.

**Granting `calendar.sync_google` to a role is not by itself enough to make sync work for
it — check whether that role can also write the sync columns back onto `tasks`.**
`pushTaskToGoogleCalendar` writes `google_event_id`/`google_calendar_owner_id`/`google_synced_at`
through the caller's own RLS-scoped client on purpose (`lib/google/task-calendar-sync.ts`'s own
comment: "a push must not be able to update a task the caller couldn't otherwise update"). `admin`
and `standard_user` already have a general `tasks` UPDATE policy, so granting them the capability
was sufficient on its own. `viewer` had no task-write RLS path at all until `0029` added one —
without that migration, granting `viewer` the app-layer capability alone would have made the
Sync button clickable while silently failing to persist the event id, which is worse than just
not working: `upsertCalendarEvent` (the actual Google API call) runs *first* and creates the
event regardless, so a rejected DB write leaves the task with no record it was ever synced and
the next click mints a duplicate event. `0029`'s fix is a second, additive UPDATE policy for
`viewer` (doesn't touch what `standard_user`/`admin` can do) paired with a `BEFORE UPDATE`
trigger restricting a viewer's write to exactly those three columns plus `updated_at` — so
`viewer` gets working sync without gaining general `task.update`. See `supabase/schema.md`'s
`tasks` RLS note for the policy/trigger names.

**Events go to a secondary calendar named "Critical Path", not the user's primary one.**
`resolveCalendarId()` (`lib/google/calendar.ts`) looks for a calendar with that name that the user
can write to (`calendarList.list`, `minAccessRole: "writer"`, matched on `summaryOverride ??
summary`). If there is none, it creates one (`calendars.insert`). The id is cached in
`google_oauth_tokens.calendar_id` (`0031`), so only the first push lists calendars. If the user
deletes the calendar in Google, the next insert 404s. The cache is then cleared and the calendar
is found or created again. Listing calendars reads metadata only (name, id, access role), not
events, so it doesn't break the one-way rule above.

**Events already pushed to primary before this change are deliberately left there.** Nothing
migrates or deletes them. A task or holiday whose stored `google_event_id` is a primary-calendar
id 404s against "Critical Path". `upsertEvent` then inserts a fresh copy there and relinks it.
`deleteCalendarEvent` treats the 404 as already gone. So after the switch, a user can see a task
twice: the old primary copy and the new "Critical Path" copy. That's accepted.

**This needs two more OAuth scopes than `calendar.events`, and existing tokens don't have them.**
`GOOGLE_CALENDAR_OAUTH_SCOPES` (`constants/google-calendar.ts`) adds
`calendar.calendarlist.readonly` (to find the calendar by name) and `calendar.app.created` (to
create it). Both are narrower than the full `calendar` scope. A token granted before this change
gets a 403 on the calendar list. `ensureCriticalPathCalendar` runs first in `syncGoogleCalendar`
and turns that 403 into a "sign out and sign back in" message. The scopes must also be listed on
the Google Cloud OAuth consent screen, or Google won't grant them.

**`upsertCalendarEvent`/`deleteCalendarEvent` (`lib/google/calendar.ts`) are generic, not
task-specific — the names were changed from `upsertTaskCalendarEvent`/`deleteTaskCalendarEvent`
when holidays started using them too.** Nothing about the low-level Google API call ever
referenced a task; only the two callers built on top of it did (`task-calendar-sync.ts`,
`holiday-calendar-sync.ts`). The exact `task_calendar_events(task_id, profile_id, event_id)`
join table sketched two paragraphs up as a hypothetical for per-owner task copies is precisely
the shape `holiday_calendar_events` (`0028`) actually took — same reasoning, a different entity
that got there first: a holiday has no owner column at all to begin with, so the join table
wasn't optional the way it would be for tasks. See the Holidays section below for how the two
differ (holidays have no first-claim-wins conflict, since every syncing user gets their own
independent copy).

---

## Teams / Departments (`/management/teams`)

**The seed list is the client's own dropdown, not sample data.** `supabase/seed-departments.sql`
mirrors the `Department` column of the `Lists` sheet in
`Critical Path - Data exported 24th August 2026.xlsx`, which is the source of the TASKS sheet's
`OWNER` and `PEOPLE INVOLVED` values. Names are verbatim from that sheet — don't "tidy" the
casing (`Brand Managers` plural, `E-Commerce` hyphenated, `SLT` uppercase); a CSV import of that
export matches on exact string.

**Two dropdown entries are not departments.** `Johan Persson` and `Par Lundqvist` are individual
people the spreadsheet had nowhere else to put. They're excluded from the seed and belong in
`profiles` instead. If a task import hits either as an owner, map it to a person, not a new
department row.

**Lives at `/management/teams`, not `/departments`.** Moved under Management alongside Users and
renamed "Teams / Departments" — it's admin-only now (`admin.manage_lookups`) rather than visible
to every internal role, because managing a team means editing user records. Department *names*
still resolve for everyone through the table's own open read policy, so task rows keep their
labels.

**A person belongs to exactly one department.** Membership is `profiles.department_id`, a single
nullable FK (0009) — not a join table. So "add to team" is an UPDATE on the person, and adding
someone already on another team **moves** them rather than granting a second membership. The
members dialog labels those candidates "Move" instead of "Add" for that reason. If multi-team
membership is ever needed, that's a `department_members` join table plus a rewrite of the
`task_participant_profiles` view and the two RLS helper functions that flatten department
membership — not a small change.

**Member add/remove is gated on `admin.manage_users`, not `admin.manage_lookups`.** It writes
`profiles.department_id`, which the privileged-column guard trigger (0001/0009) restricts to
admins regardless — a lookup-only permission would be rejected by the database anyway, so the
app-layer gate matches what the DB actually enforces.

**The member count is a second query, not a column.** `countMembersFor()` selects one column for
the current page's department ids and tallies in memory — PostgREST can't return a grouped count
alongside rows, and a per-row `head: true` count would be one round trip per department. It is
therefore **not sortable**; the column has `enableSorting: false` because there's nothing for
Postgres to ORDER BY.

**Departments are assignable parties, not just a label on a user.** `OWNER` and `PEOPLE INVOLVED`
in the export both hold *department* names, not people (832 of 833 owner rows). Since
`0015_task_participants.sql` a department attaches directly to a task via
`task_participants.department_id` — this is the **normal path**, not the fallback. Attaching an
individual profile is the exception, kept because the sheet does contain two person-valued
entries. The old `0009_departments.sql` note that "a task's department is read via its assignee's
profile" is obsolete.

**A department participant with zero members is valid.** `Vendor` (254 owner rows) and `Supplier`
(16) are external — `is_external = true`, no logins, ever. Anything resolving a task to human
recipients (reminders, calendar push) must handle the empty set and fall back to
`departments.contact_email` rather than treating it as a data error.

**Owner is 1..n, not 1.** 283 of 833 tasks (34%) have two owners — `Product Development, Vendor`,
`US Team, EU Team`. Confirmed intentional. Don't reintroduce a single-owner assumption; if it
ever needs enforcing it's a partial unique index on `(task_id) where role = 'owner'`.

**Owner is a subset of involved, not a separate axis.** The owning party also appears in PEOPLE
INVOLVED on 795 of 833 rows (95%) — which is why `task_participants` is one table with a `role`
column rather than two parallel join tables, and why `task_participant_profiles` uses `union`
rather than `union all`.

---

## Tasks — Owners & People Involved

**One picker stack serves both fields, and both accept departments and people.**
`party-row.tsx` → `party-search-dropdown.tsx` → `party-list-field.tsx`, buffered locally by the
create form and by the detail drawer alike. Owners and People Involved differ only by their
`role` value and their labels — don't fork a second stack for one of them.

**The drawer buffers and confirms; it does not write per click.** Adds and removes change local
state only (`use-participants-draft.ts`); nothing reaches the database until Save, which writes
both roles through `setTaskParticipants` in one call. Closing with pending edits asks before
discarding. This replaced an optimistic per-click write (`addTaskParticipant` /
`removeTaskParticipant`, both deleted) — that version wrote on every click, so a single editing
session produced a scatter of audit-log rows instead of one entry saying what changed. There is
now exactly one write path for participants; don't add a second.

**A party is addressed as a `kind:uuid` string** (`lib/party.ts`) everywhere on the client —
form values, option values, React keys — and split back into `profile_id`/`department_id` on
write. `task_participants` has no single id column to key on, so this encoding is what lets one
`<PartyListField>` hold a mixed set.

**The Owner grid column is display-only.** Owners are rows in another table, so there's nothing
to sort on and no single value an inline `<EditableCell>` select could write. Owners are edited
in the detail drawer. `assignee_id` is gone from `EDITABLE_FIELDS` and from `taskSchema` for the
same reason.

**`tasks.assignee_id` is still written, as a shim.** `createTask` sets it to the first
*individual* owner, or null when every owner is a department (the common case). Calendar sync
(`calendar/_actions.ts`) still reads it, which is why it can't be dropped yet — that's the
follow-up `0016`, gated on the one-way calendar rework.

**Minimum fields to create a task (client-confirmed): Task Name, Season, Brand, Key Stage,
Gender, DPSP Category, Owners, People Involved.** Enforced only in `taskCreateSchema`
(`tasks/schema.ts`) — `brand_id`/`key_stage_id`/`dpsp_category`/`gender` require a real value (no
"none" sentinel) and `people_involved` requires at least one entry, on top of `taskSchema`'s
existing `task_name`/`season_id`/`owners` requirements. `taskUpdateSchema` (inline-edit,
`taskSchema.partial()`) is deliberately untouched: an existing task can still have any of these
cleared back to null/empty, since the DB columns stay nullable and older/seeded tasks (see
below — seeded `brand_id` is null for every row) predate this rule.

**`gender` is `not null` at the DB layer but starts unselected on the create form**, same
treatment as `dpsp_category`: `taskSchema`'s base `gender` is still `z.enum(taskGenderValues)`
(used as-is by `taskUpdateSchema`/inline-edit, where the field is optional-by-`.partial()` but
must be a real enum value when it *is* patched), while `taskCreateSchema` overrides it to a loose
string + `.refine()` membership check so `task-form.tsx` can default it to `""` instead of
silently pre-selecting "Guys". `_actions.ts`'s `narrowGender()` casts the refined string back to
the enum literal before the insert — mirrors `normaliseDpspCategory`, minus the "none" → `null`
step, since gender has no such sentinel (it's required, never cleared, at creation).

**Filtering by a participant costs an extra round trip.** PostgREST can't express
`id in (select task_id from …)` inline, so `listTasks` resolves the id set first — via
`task_participants` for the Owner filter, via the `task_participant_profiles` view for
"relevant to me". An empty result set filters on an impossible uuid (`EMPTY_RESULT_ID`) rather
than dropping the clause, which would silently widen the query to "no filter at all".

**The Owner filter accepts several owners at once (`multiple: true`), matched as a union.**
Picking Planning and Marketing means owned by either, not both — same as every other multi-select
toolbar filter (see "Data tables" above). Owner and People Involved are still `.reduce`d together
as an intersection when both are set, unchanged from before.

**"My tasks" is now transitive.** My Tasks scopes through `task_participant_profiles`, so being
in Planning shows you every task Planning owns, not just ones naming you. My Tasks deliberately
has no Owner filter — the page is already scoped to you.

**The seeded tasks are real client data, and `supabase/seed-tasks.sql` hardcodes live uuids.**
793 of the export's 833 rows, with the actual `season_id`/`key_stage_id`/`department_id` values
read out of the database at generation time — not subqueries. Re-seed any of those lookups and
every FK in that file goes stale; regenerate it rather than patching. Task ids are uuid5 of
(season, task name, sheet row), so regenerating is idempotent and a re-run replaces rather than
duplicates.

**What the export doesn't carry, and what the seed therefore invented:** `gender` is `unisex`,
`status` is `not_started`, `priority` is `med`, `brand_id` is null — none of these exist as
columns in the sheet. The `X` column looks like a completion marker but isn't one (166
future-dated tasks carry it, 63 past-due tasks don't), so it's ignored rather than mapped to
`status`. Don't read the seeded statuses as meaningful client data.

**40 rows were excluded and 35 had their start date dropped** — see
`supabase/seed-tasks-excluded.md` for the per-row reasons. The dropped starts were later than
their own end dates; the sheet's `Duration (Days)` is negative on exactly those rows, so it's
bad data at source, not a mapping error.

**Gender is Guys/Girls now, not Men/Women, and Unisex is retired.** Client decision, applied by
`0026_task_gender_rename.sql` via `ALTER TYPE ... RENAME VALUE` — every existing row kept its
data (a `men` row is `guys` after the rename, same row). `unisex` is a different case: the client
said only two values should exist going forward and explicitly didn't want existing data
migrated, but Postgres has no `DROP VALUE` for enums, so it stays a legal `task_gender` value at
the database layer — it's just gone from `taskGenderValues`/`TASK_GENDER_CONFIG`
(`tasks/schema.ts` / `constants/task-gender.ts`), meaning nothing in the app can select it
anymore, new or edited. Two concrete effects worth knowing:
- **Every seeded historical task is `unisex`** (the source export never carried a gender column
  at all — see above), so this isn't a rare edge case; it's the *entire* pre-existing dataset. A
  legacy `unisex` task's badge falls back to `StatusBadge`'s unstyled raw-value display since
  there's no config entry for it anymore.
- **The Dashboard's gender breakdown silently drops them.** `data/dashboard.ts` seeds
  `genderGroups` from `taskGenderValues` (now just Guys/Girls) and skips counting a fact whose
  gender has no matching group — so every legacy `unisex` task (again, the whole pre-existing
  dataset) is invisible to that one chart specifically, undercounting its total the same way
  `tasks-by-brand` already under-represents totals for a null `brand_id`. Accepted, not a bug:
  this is what "don't care about existing data, focus on upcoming data" was asked for.

---

## Priority (hidden) & optional Due Date

**Priority is a real column, deliberately not shown in the UI.** Per client request ("Priority
field is not needed — unless I requested this?"), it's removed from the grid, the create form,
the detail drawer, and both boards' toolbar filters — but the `tasks.priority` column, its zod
field, and `TASK_PRIORITY_CONFIG` are untouched, and the Task Records export still offers it as
an opt-in column (just `defaultSelected: false` now, matching the grid). This is a UI-only,
easily-reversible removal, not a schema change — don't repurpose the column for anything else
while it's hidden.

**`due_date` is nullable since `0022_tasks_due_date_optional.sql`.** Some of the client's
historical data has no known due date; forcing one would mean fabricating data. A task with
`due_date is null`:
- **Still appears on the Tasks grid** — sorts to the bottom regardless of ascending/descending
  (`nullsFirst: false` in `data/tasks.ts`'s `taskScope`/`listOverdueTasks`), and its cell reads
  "No due date" instead of a formatted date.
- **Is never overdue.** Nothing in this codebase auto-stamps `status = 'overdue'` yet (see the
  Google Calendar sync note above on the status-rollover cron) — the one place that computes
  "overdue" live rather than trusting the stored status, `calendar-task-chip.tsx`, explicitly
  short-circuits on `due_date === null`. If a status-rollover cron is ever built, it must carry
  the same guard.
- **Is excluded from the Calendar and Gantt/Timeline** — both are date-positioned views and
  simply have nowhere to place a task with no relevant date (`listTasksByDueDateRange`'s
  range filter and `timelineOverlapFilter`'s three clauses both naturally exclude it; see
  `data/tasks.ts`). Not a bug to fix — there's no date to draw a bar or a cell against.
- **Is excluded from the Dashboard's Monthly/Weekly Completion Trend only** — see that section's
  gotchas above. Still counted in every other dashboard tile.

---

## Seasons & Key Stages

**Both are seeded from client data, not invented.** `supabase/seed-seasons.sql` (28 rows) and
`supabase/seed-key-stages.sql` (13 rows) come from the SEASON and KEY STAGE columns of
`Critical Path - Data exported 24th August 2026.xlsx`. `season_code` and `key_stages.name` are
verbatim, including the client's own inconsistency (`RJ'S H1'27` upper vs `RJ's H2'27` lower) —
a CSV import of that export matches on exact string, so normalising the casing breaks it.

**Seasons have no date range in the source.** `start_date`/`end_date` are derived as the tightest
interval containing that season's tasks (min/max of Working Timeline start/end and DUE DATE).
`status` is computed against the seed date, not stored in the sheet — it's a snapshot.

**Key stage order is not preserved and the Timeline is wrong because of it.** `key_stages` has no
`sort_order` column (`0008_key_stages.sql`) and `data/key-stages.ts` orders by `name`, so
Timeline/Gantt groups stages alphabetically. The real sequence is the insert order in the seed
file (PRE SEASON PREP → TREND TRIP → CREATIVE DIRECTION → RANGE DEVELOPMENT → RANGE
REVIEW/REFINEMENT → RANGE RELEASE → SALES TOOLS FORMATION → SELL PERIOD → CONSOLIDATION →
CAMPAIGN → SHIPPING → LAUNCH), but insertion order isn't retrievable. Needs a `sort_order`
column before Timeline grouping reads correctly.

**RANGE REVIEW and RANGE REFINEMENT are the same slot, never co-occurring** — quarterly seasons
use REFINEMENT, monthly INJECTION seasons use REVIEW. Don't merge them; don't expect both.

**Reseeding seasons deletes tasks.** `brand_seasons.season_id` is `on delete restrict` and
`tasks.season_id` is a NOT NULL FK, so `seed-seasons.sql` has to clear `task_people`, `tasks`,
and `brand_seasons` before it can touch `seasons`. It also invalidates the hardcoded season
UUIDs in `seed-brands.sql`'s `brand_seasons` block — re-link by `season_code`, don't paste new
UUIDs.

---

## Dashboard (`/dashboard`)

**Cost: 3 Supabase calls for the page** (6 per load; the other 3 are the authenticated shell —
proxy `getUser`, layout `getUser` + profiles SELECT — and every route pays them). All 3 are
issued together via `Promise.all`.

**One query behind almost everything.** `getDashboardMetrics()` (`src/data/dashboard.ts`) makes
a single pass over `tasks` reading 5 narrow columns. Every tile and chart is a projection of it,
so no two cards can disagree. All filters and the Monthly/Weekly toggle run client-side over
already-loaded data — **0 requests on interaction**.

**The Gantt card is the exception, and has to be.** `getDashboardMetrics()` returns counts, not
task rows, and a bar needs an id, a name and three dates — so the card gets its own two queries
(`listTasksForTimeline` over the preview band, `listOverdueTasks`). Its season/brand dropdowns
are still built off `metrics.bySeason`/`byBrand` via `toFilterOptions()`, so there is no third
query for lookup options. It then filters those two result sets in the browser like every other
card — **still 0 requests on interaction**.

| Card | Basis |
|---|---|
| Stat tiles | All-time counts + share of total |
| Tasks by Season | Ranked by task count, **top 6**, tail folded into one "Other (N)" slice |
| Task Status Overview | All 4 enum statuses, enum order, never folded |
| Completion Rate | Completed vs. everything else |
| Tasks by Brand | Ranked by task count, **top 5**, tail truncated with an "N more" hint |
| Tasks by Gender | All 3 enum values |
| Task Completion | Completed per period + 4 window-scoped tiles |
| GANTT / Timeline | Preview band of tasks, capped at **12 rows**; see the Gantt gotchas below |

### Gotchas

- **There is no `completed_at` column.** Completion is bucketed by **due date**, so "May" means
  *"of the work due in May, this much is done"* — not "completed during May". Since `due_date`
  became nullable (`0022`), a task with no due date has no period to fall into and is excluded
  from the Monthly/Weekly Completion Trend specifically — it still counts in every other tile
  (status/season/brand/gender), which aren't bucketed by date.
- **Monthly and Weekly window differently, on purpose.** Monthly = calendar-consecutive months
  spanning the data (cap 18), empty months shown. Weekly = the most recent 16 weeks *that have
  tasks due*, empties skipped — a readable week axis is ~16 bars but a year of history is 50+,
  so any trailing window lands on a stretch with no data and renders flat zero. A week with
  nothing due is no measurement, not 0%.
- **Task Completion's 4 tiles are window-scoped; the header tiles are all-time.** They are
  expected to differ. The card subtitle states its window.
- **The Status donut's centre % is pinned to overall completion**, not the current selection —
  otherwise scoping to "Overdue" would report 0% completion for the whole business.
- **Percentages are always against all tasks**, never the visible subset, so a brand's share
  doesn't change when the list is narrowed.
- **Season folds into "Other"; Brand truncates.** A bar list has no ring to complete, so a
  synthetic "Other" bar would outrank real brands. Both dropdowns list *every* entity.
- **Export is a Route Handler** (`dashboard/export/route.ts`), not client-side — an XLSX
  workbook needs `exceljs` server-side, and the dialog's configurable Task Records columns need
  a fresh query anyway, so CSV was moved onto the same code path rather than keeping two.
  `dashboard-export-button.tsx` opens a dialog (format + which sections + which Task Records
  columns), then `fetch()`s the route and downloads the response as a blob — no `<a href>` GET
  navigation, so a permission/validation error surfaces as a toast instead of a browser download
  of a JSON error body.
  - **XLSX** can hold any combination of three tabs: **Dashboard Summary** (the full
    Status/Season/Brand/Gender breakdowns — full, not the cards' trimmed top-N) and
    **Completion Trend** (Monthly + Weekly, `lib/export/*` columns from `dashboard/export/
    summary-rows.ts`) are always the **whole-table** numbers, never scoped to anything — same
    reasoning as `getDashboardMetrics()` itself, see the note in `summary-rows.ts`. **Task
    Records** is one row per task with a checkbox-configurable column set
    (`dashboard/export/task-record-columns.ts`) — deliberately excludes `assignee_id`, superseded
    by `task_participants` (see Tasks section below).
  - **CSV holds exactly one table** — `lib/export/csv.ts`'s `buildCsv()` takes a single sheet,
    so the route's `resolveSections()` collapses a CSV request down to one section (preferring
    "records" if it was asked for) even if a hand-built query string asks for more. The dialog
    itself always requests Task Records for CSV, since that's the one section a column checklist
    actually applies to.
  - **Timeline/Gantt is deliberately never exportable from this dialog** — it's a preview band of
    12 rows, not a complete dataset; there is nothing in it that Task Records doesn't already
    cover in full.
  - **Bounded at `MAX_EXPORT_ROWS` (5000)**, same cap `listTasksForExport()` (`data/tasks.ts`)
    uses everywhere — past that the response carries `X-Export-Truncated: true` and the dialog's
    success toast says so; there's no UI to raise the cap, since a bigger export belongs behind a
    background job with an emailed link, not a synchronous request.
  - **Only `dashboard.export_reports` roles reach the route** (`requirePermission`, same matrix
    as everywhere else) — `admin`/`standard_user`/`viewer` all get it; `external` gets
    `dashboard.view` but not this (see `lib/permissions.ts`'s `EXTERNAL_ALLOWED` comment: exports
    leave the platform's row-level scoping behind once downloaded, which is a deliberately
    different bar from viewing scoped data in the UI). `dashboard/page.tsx` also hides the Export
    button itself for anyone without it (`can(profile.role, "dashboard.export_reports")`), same
    "hide the dead-end, still enforce server-side" pattern as `canAssignPeople` on the Gantt card
    below — the route check is what's load-bearing, the hidden button is just not leaving a
    guaranteed-403 control on screen.
- **The Overdue tile links into `/tasks` pre-filtered, rather than the dashboard owning a
  second overdue list.** The href is built with `dataTableSearchParamsHref` off the *same*
  parser definition and the *same* defaults (`TASKS_QUERY_STATE`) the tasks page loads with —
  `filters` is a JSON search param, and nuqs omits values matching the defaults, so a
  hand-written query string or a mismatched `defaultPageSize` is how such a link silently
  arrives unfiltered.
- **Scaling:** 1 request per 1000 live tasks (guard at 20 pages). Past ~20k tasks this belongs
  in a SQL view or RPC.
- Proxy and layout both validate the same token (calls #1 and #2). Inherent to the Supabase SSR
  pattern — middleware and RSC are separate contexts, so `cache()` can't bridge them.

### Gantt card gotchas (`timeline-gantt-card.tsx`)

- **Its controls are `useState`, not `nuqs` — deliberately, and against the usual house rule.**
  Every other list in the app puts view/filter state in the URL. Here that would make each
  filter click a real navigation, re-running `getDashboardMetrics()` (a full table scan) to
  redraw one card. The whole page is built on "fetch once, narrow in the browser", and this card
  follows it. `/timeline` is the URL-driven, shareable version.
- **Prev/Next clamp to the fetched band and disable at its edges.** The band is last month
  through next month (`getTimelinePreviewBand()`), padded to whole weeks. Stepping outside what
  was fetched would draw an empty chart that reads as "no tasks" rather than "not loaded". Widen
  the band and the query widens with it — `page.tsx` derives the query range from the same
  function the card clamps against, so they cannot drift.
- **Rows are capped at 12** (`TIMELINE_PREVIEW_ROW_COUNT`). The band can hold hundreds of tasks;
  a dashboard card that grows without limit stops being a summary. When the cap bites, the
  footer swaps the "click a bar" hint for a "Showing 12 of N" link into `/timeline`.
- **Off-window tasks are filtered out before `TimelineGrid`, not left to it.** `getBarGeometry()`
  returns `null` for them and the grid still renders the row — fine on `/timeline`, where the
  query is window-bounded, but here it would mean ~3 months of empty rows in Week view.
- **"View All" and the truncation link carry the card's current state** into `/timeline` as
  `view`/`date`/`seasonId`/`brandId`. Those keys must match `timelineSearchParams()`.
- **The card fills the whole shared `TimelineControls` shape but drives four of its fields.**
  Key stage, owner, people involved and the search term stay permanently empty here:
  `TimelineToolbar` renders a filter only when given options, and the card gives it none for
  those — they'd need a client-side participant match over a capped 12-row preview, which is
  the opposite of what a preview is for.
- The card's `loading.tsx` block hardcodes `h-[616px]` — 14 × the grid's 44px `ROW_HEIGHT`
  (12 rows + a 2-band header). Tailwind can't see a computed class, so it can't be derived from
  the constant; if either number changes, change this too.

---

## Timeline / Gantt (`/timeline`)

**Cost: 7 Supabase calls, 9 with a search term** — timeline tasks (2: a narrow matching pass
and a wide page fetch, see below), overdue tasks, season options, brand options, key stage
options, party options (departments + people); a typed term adds a key-stage lookup and a
party-name lookup. The six independent ones are issued together via `Promise.all`. Every
control on the page re-runs the Server Component (`shallow: false`), so every one of them
re-queries; scrolling and opening the drawer do not.

**This module has a second consumer.** The Dashboard's Gantt card renders `TimelineToolbar`,
`TimelineGrid`, `TimelineTaskBar`, `TimelineStatusLegend` and `TimelineOverduePanel` — the same
components, different state source (see the Dashboard section). None of them fetch; they take
tasks, a range and a view as props, which is what makes that possible. Keep it that way: a
`data/*` import inside any of them would break the preview. Only `TimelineWorkspace` and
`page.tsx` are `/timeline`-specific.

### Zoom levels

**Four views, one geometry.** Week / Month / Quarter / Year all position bars as px-per-day
(`DAY_WIDTH`: 150 / 40 / 9 / 3). Zooming out is a smaller `DAY_WIDTH` plus a **coarser header**,
never a second layout — `getBarGeometry()` is untouched by the view beyond that one number.

- **`timeline-header.ts` owns both header bands.** Each view maps to a column unit and a group
  unit: day/week (Week, Month), week/month (Quarter), month/quarter (Year). Every band is
  measured in **days** (`dayCount`), which is what keeps the two bands, the gridlines and the
  bars on one coordinate system. Columns and groups each sum to exactly the window length —
  worth re-checking if you add a view.
- **Groups are built from the columns, not from the range.** A week straddling two months is
  assigned to the month it *starts* in, so a group boundary always lands on a column boundary.
  The visible consequence in Quarter view: the first and last month groups are short (the window
  is padded to whole weeks), and a month can read as 28 days. That is alignment, not a bug.
- **Quarter pads to whole weeks; Year does not.** Quarter's columns are weeks, so a partial week
  at either end would be a half-width column; Year's columns are months, and week-padding would
  slice January and December in half. `getTimelineRange()` encodes both.
- **Q1–Q4 are calendar quarters** (Jan–Mar, Apr–Jun, Jul–Sep, Oct–Dec) — the client's
  definition, and what date-fns' `startOfQuarter` gives. Don't switch to a fiscal-year quarter
  without changing both.
- **Gridlines stay one background per row.** Uniform bands (days, or Quarter's whole weeks) use
  a `repeating-linear-gradient`; a month band isn't uniform (28–31 days), so it gets explicit
  stops — a repeat there would drift ~5 days by December. Either way it is never one node per
  column per row.
- **Year is the DEFAULT view** (`TIMELINE_DEFAULT_VIEW`), so the page opens on the widest
  window — the whole year's schedule at a glance, narrowed from there. Read the note below
  before changing it back.
- **The narrow pass is unbounded, and Year is what makes that matter.** The browser only ever
  receives a page, but pass 1 reads every task overlapping the window (540 of 833 for the seed
  year) into the Server Component — it has to, or the match count and the page boundaries would
  only be right for one page's worth. It is three narrow columns, so this is cheap, but it would
  hit PostgREST's 1000-row ceiling **silently** past that size. If the dataset grows, move the
  matching into SQL (a view or an RPC) rather than letting the ceiling truncate it — the default
  view is Year, so that is where work would start quietly disappearing.
- **Anything hand-building a `/timeline` link compares `view` against `TIMELINE_DEFAULT_VIEW`,
  never against its own starting view.** nuqs omits a param equal to its default, so a link that
  leaves `view` out lands on Year. The Dashboard preview starts on Month and is the live case:
  comparing against its own initial view would send "View All" from a Month card to a Year page.
- **The Dashboard preview offers Week/Month only** (`PREVIEW_VIEWS`). Its data is one fixed
  3-month band; a Quarter or Year window would draw mostly-empty columns that read as "no
  tasks". Zooming out that far is what `/timeline` is for.

### Search and pagination are server-side, and run as TWO passes

Everything on this page — window, dropdown filters, search term, page — is answered by
`listTasksForTimeline`. Nothing is narrowed in the browser: it receives only the ~25 rows it
draws. `q`, `page` and `pageSize` are therefore in `timelineSearchParams()` alongside the
filters, on the same non-shallow hook, so a change to any of them re-runs the query.

**Why two passes and not one query.** The search has to reach owners and people involved, whose
names live on `profiles`/`departments` while the link lives on `task_participants` — PostgREST
can't OR across that in a single filter, so the participant leg comes back as a task-id set that
can be hundreds of uuids long. Inlining that into the main query builds a URL long enough to be
rejected. Instead:

1. **Narrow pass** — `timelineScope()` with a `id, task_name, key_stage_id` projection: the
   window, the dropdown filters and the ordering, whole result, no row limit.
2. Task name and key stage are matched against that projection in memory; owners/people arrive
   as a Set from `taskIdsMatchingPartyName()`. `ilike '%term%'` and `includes()` on a lowercased
   string are the same case-insensitive substring test, which is what keeps the legs consistent.
3. **Wide pass** — only the page's ~25 ids, fetched with the full `TASK_SELECT` shape so a
   clicked bar still opens the shared drawer without a second request.

`timelineScope()` is shared by both passes on purpose: if they ever disagreed about the window
or the filters, the page would be sliced from a different set than it was fetched from.

- **`.order("id")` is a correctness fix, not decoration.** Plenty of tasks share a start and due
  date; without a total order, tied rows can come back in a different sequence per query, and
  across two passes that lets a row land on two pages or on none. Verified by paging the full
  year: 540 distinct rows over 22 pages, no gaps, no duplicates.
- **Two `.or()` calls on one query AND together** — the overlap filter and (where used) any
  second disjunction. Confirmed against the live database, not assumed.
- **Search matches task name, season (name or code), brand, key stage, owners and people
  involved** — `resolveTaskSearchMatcher()` in `data/task-search.ts`, the same matcher `/tasks`
  uses. It started as the four fields the client named for the Timeline (name, key stage,
  owners, people) and picked up season/brand when the Tasks grid asked for them: one matcher for
  both surfaces beats two that quietly diverge. Season and brand still have their own dropdowns
  here — the search is the broad tool, the dropdowns the precise one.
- **Name lookups are capped at 100 parties** (`NAME_MATCH_LIMIT`). Past that a term isn't
  identifying anyone, it's the directory — same reasoning as `searchParties`' own limit.
- **Terms are sanitised before they reach an `.or()` string** (`sanitiseOrSearchTerm`,
  `lib/utils.ts`). Commas and parens are PostgREST filter syntax; everything else binds through
  `.ilike()`, and id lists are the only interpolated values.
- **Typing is debounced 400ms at the CALL, not on the parser.** nuqs rate-limits per key, so a
  parser-level debounce would flush the accompanying `page: null` reset immediately and the term
  400ms later — two navigations and a flash of unfiltered results per keystroke. Dropdowns and
  the period buttons stay immediate.
- **Any toolbar change resets to page 1** — `setControls` always sends `page: null` alongside.
  The render also **clamps** `page` for display, so a stale or hand-edited URL pointing past the
  end of a narrowed result shows the first page rather than an empty chart reading as "no tasks".
- **`TimelineGrid` draws exactly the rows it is handed** and does no filtering or paging. That
  is what lets the Dashboard preview pass its own 12-row slice through the same component.
- **`listTasksForTimeline` returns `{ data, rowCount }`, and omitting `pageSize` means "the
  whole window" in one query** — the Dashboard preview's path, which fetches its band once and
  narrows in the browser like every other card on that page.
- **Search does not touch the Overdue panel.** It answers "what is late" and is already
  deliberately un-scoped to the window; a term typed to find one task shouldn't quietly re-scope
  it. It does still respect the toolbar's dropdown filters.
- **`PaginationControls` (`components/shared/`) is shared with the data tables.**
  `DataTablePagination` is now a thin @tanstack adapter over it, so page numbers, ellipses and
  the size selector exist once. The Timeline offers 20/25/30 per page (default 25).
- **`data/tasks.ts` runs over the ~250-line guideline, deliberately.** Splitting the timeline
  query into its own module would mean exporting `TASK_SELECT`, `isTaskStatus` and
  `EMPTY_RESULT_ID`, and breaking the stronger rule in `CLAUDE.md` that task queries live in one
  file. The participant-id lookups were extracted to `data/task-participants.ts` instead, since
  three separate queries need exactly those.

### Gotchas

- **The Owner and People Involved filters intersect, and can't be PostgREST clauses.** Both are
  `kind:uuid` party keys against `task_participants`, not columns on `tasks`, so
  `participantTaskIds()` (`data/tasks.ts`) resolves them to a task-id allow-list first — set
  together they must intersect, not union. An unmatched party yields **zero** rows via
  `EMPTY_RESULT_ID`; dropping the clause instead would silently widen to "no filter at all".
  Same helper serves the tasks grid, the timeline and the overdue panel.
- **`start_date` and `end_date` are nullable; `due_date` is not.** In practice almost every task
  has neither (2 of 34 at time of writing). So a bar's range is
  `start = start_date ?? due_date`, `end = end_date ?? due_date` — an unscheduled task renders
  as a **single-day milestone on its due date** rather than vanishing from the chart. Milestones
  are drawn with a dashed outline and a tinted fill so a defaulted width never reads as a real
  schedule. Strict `start_date`/`end_date`-only rendering would show 2 bars out of 34.
- **The coalescing exists twice and must stay in step**: `timelineBarRange()`
  (`timeline-utils.ts`) client-side, and `timelineOverlapFilter()` (`data/tasks.ts`) as its SQL
  mirror. If they disagree, the query and the geometry disagree about which tasks are visible.
- **Never `new Date(dateString)` on a date column.** Postgres `date` arrives as `"yyyy-MM-dd"`,
  which the native parser reads as *UTC* midnight — one day earlier for anyone at a negative UTC
  offset. Use `parseDateOnly()` (`lib/dates.ts`), which parses as local midnight. `formatDate()`
  goes through it too.
- **Bars are inclusive of both ends** — a task starting and ending the same day occupies one
  day, hence the `+1` in `getBarGeometry`. Bars clipped by the window get a squared-off edge so
  they read as continuing rather than genuinely ending at the screen edge.
- **The overdue panel is deliberately NOT window-scoped** — overdue work from an earlier month
  is exactly what shouldn't scroll out of sight. It does respect every toolbar filter
  (season, brand, key stage, owner, people involved) so it agrees with the chart beside it.
- **Row alignment is structural, not synchronised.** The task column and its bar are the same
  DOM row inside one scroll container, with the left column `sticky left-0`. There is no scroll
  listener, and alignment cannot drift.
- **"Not Started" is grey, not blue** as an outside spec suggested — `status-notstarted-base`
  (`#94a3b8`) is the design system's token and wins over an external colour suggestion.
- Day gridlines are a `repeating-linear-gradient`, not one node per day — a 42-day month across
  many rows is a lot of DOM to buy a 1px line.
- **No drag-to-reschedule.** Read-only by design; writing dates back would need a mutation path
  and conflict rules that don't exist yet.

---

## Holidays (`/holidays`, Calendar overlay)

**Manual entry only — no sync job, no external API, no `PUBLIC_HOLIDAY_API_KEY`.** An earlier
design (see `docs/specs/0001-public-holidays/rationale.md`) planned a nightly Calendarific sync;
the client's actual answer was simpler — an admin enters every holiday by hand, one at a time or
via CSV bulk import. If this ever needs revisiting, it is a decision (`/architect`), not a quiet
re-add.

**`country` is plain text, not an enum — deliberately, and this is the second time it changed
mid-build.** The first version made it a fixed enum (`AU`/`CN`/`IN`/`TR`); Umar asked mid-build
for room to add a country later without a migration, so it's `text` instead, with the 4 known
ones offered only as quick-pick buttons in `holiday-form.tsx` and `constants/holiday-country.ts`
(`KNOWN_HOLIDAY_COUNTRIES`, suggestions only, not a closed list). A country typed into a form or
a CSV row that isn't in that list is just as valid — it becomes its own DataTable filter chip and
Calendar checkbox automatically, since both read `listDistinctHolidayCountries()` (a real
`SELECT DISTINCT`) rather than a hardcoded 4-item constant.

**The admin list's Country column colour is derived, not stored.** No `color` column exists (the
country isn't a fixed lookup with its own row to hold one), so `columns.tsx` reuses
`getVizColorForId(country)` — the same deterministic hash-to-palette fallback other entities with
no stored colour already use. Two different countries typed as different strings (`"Turkey"` vs
`"TR"`) get different, unrelated colours and are treated as different countries entirely — this
table does no normalisation between a code and a full name.

**Bulk CSV import is per-row independent, not a transaction.** `bulkImportHolidays` in
`holidays/_actions.ts` validates and inserts one row at a time against the same `holidaySchema`
the single "Add Holiday" form uses, and keeps going after a bad row — a typo in row 3 of a
500-row file never blocks rows 1, 2, and 4. Every row's outcome (`created` / `duplicate` /
`invalid`) comes back in one array and renders in a results table (`csv-bulk-import.tsx`), styled
through `HOLIDAY_IMPORT_STATUS_CONFIG` — the same generic `<StatusBadge>` every other per-row or
per-entity status already uses, a new config map, not a new component.

**Duplicate detection is two-layered.** A real DB row with the same `(country, holiday_date,
name)` is caught by the unique constraint itself (a Postgres `23505`, mapped to `"duplicate"` in
the results). Two identical rows *within the same uploaded file* are caught separately, by an
in-memory `Set` of accepted keys built up as the loop runs — the DB constraint alone can't catch
that case for two rows inserted one after another in the same request.

**The CSV template's headers and the parser's header matching share one constant**
(`HOLIDAY_CSV_HEADERS` in `holidays/schema.ts`), so the download and the upload can never drift
out of sync with each other. The parser (`_actions.ts`'s `FIELD_BY_HEADER`) matches case- and
spacing-insensitively (`"Event Name"`, `"event_name"`, `"EVENT NAME"` all resolve the same
column), since a CSV re-opened and re-saved in different spreadsheet software doesn't reliably
preserve exact header casing.

**The row cap (`MAX_BULK_HOLIDAY_ROWS = 500`) rejects the whole file up front**, before any row
is written — not a partial import that silently stops at row 500. Sized against
`lib/export/types.ts`'s `MAX_LOOKUP_EXPORT_ROWS` (1000) for a lookup table, halved since an
*import* does a write per row instead of an export's single bounded read.

**The Calendar's holiday chip is one consistent style, not colour-coded by country.** Client
request was "a special tag or highlight", not "a different colour per country" — the country
checkboxes in the toolbar already do the job of distinguishing countries, so
`calendar-holiday-chip.tsx` uses a single `accent-teal` treatment for every country. Rendered
above a day's task chips, in its own row, and does **not** count toward the month view's
"3 tasks then +N more" overflow — holidays and tasks are separate concerns.

**An empty selection means every country's holidays show, same as every country being checked —
but the checkboxes themselves start unchecked, not all-checked.** `calendar-toolbar.tsx`'s
`CalendarMultiSelectFilter` (shared by every Calendar filter, not just Holiday Country) treats an
empty `selected` array as "no filter applied" in query terms (matching nuqs's
`parseAsArrayOf(...).withDefault([])`), not "show nothing" — there's no way to reach an actual
empty-results state through the UI, by design. This used to also drive the checkboxes' visual
state (every box shown checked when nothing was picked), but that read as "already filtered" on
first load; checkboxes now only ever reflect what was actually clicked, same as the Tasks grid's
own multi-select toolbar filters, even though the untouched state still means unfiltered.

**Holidays also push to Google Calendar, from the same Sync button tasks already use — added
after the feature first shipped, once `0027` was live.** `syncGoogleCalendar`
(`calendar/_actions.ts`) now runs two independent passes: the existing task pass (see the Google
Calendar sync section above), and a holiday pass that pushes every `public_holidays` row in the
same `[from, to]` window to the calling user's own calendar. See that section's note on
`holiday_calendar_events` for why holidays needed their own join table instead of reusing a
task's owner-column trick.

**Every eligible user who syncs gets every holiday — there is no first-claim-wins here, unlike
tasks.** A holiday has no owner to contest, so there's nothing to skip: 10 users syncing the same
holiday get 10 independent events, one per calendar, each tracked by its own
`holiday_calendar_events` row. Narrowed by the Calendar's country filter when one is set (see
"Sync follows the Calendar's filters" in the Google Calendar sync section).

**Editing a holiday re-pushes it to every calendar that already has it; deleting one tries to
remove it everywhere, but can leave an orphan.** `updateHoliday` calls
`resyncHolidayCalendarEvents`, looping every linked profile (best-effort, one failure doesn't
block the rest). `deleteHoliday` calls `deleteHolidayCalendarEvents` **before** the delete, since
the link rows needed to find each Google event cascade away the instant the holiday row does. If
a specific user's Google call fails at that exact moment (expired token, network blip), that one
event is stuck on their calendar with no later retry path — the tracking row that would have let
a future sync find and remove it is already gone. Accepted, not fixed: holidays are hard-deleted
(no `deleted_at` to give a removal pass something to notice later, unlike tasks), and this was a
known tradeoff of that choice, not a new gap.

**Migrations `0027_public_holidays.sql` and `0028_holiday_calendar_events.sql` need to be applied
manually** (this environment has no `supabase` CLI / linked project access) — run them via your
normal deploy step, then regenerate types (`supabase gen types typescript --linked >
src/types/supabase.ts`; hand-edited in the meantime to keep the build green).

## External Links (`/external-links`)

**Cost: 2 Supabase calls** — the paginated link list and the current profile.

**Admin-only writes, everyone-internal reads, enforced in three places that must agree:** the
`admin.manage_lookups` check inside every Server Action (`requirePermission`), the `canManage`
flag that decides whether the Add button and the row pencil/delete render at all, and
`external_links_write_admin` in `0021`. Reads are `lookups.view` + `requirePageAccess` in the
page, mirrored by `external_links_select_internal`.

**Read access is deliberately narrower than the other lookup tables.** `key_stages`,
`departments` and friends are readable by *any* active user because an external user's own task
rows have to render their labels. Nothing renders an external link except this page, so its
policy excludes `external` outright rather than relying on the app layer alone.

**There is no `sort_order` column, so the list is ordered by title.** That is the only stable
reading order the table can offer. If the client asks to arrange links by hand, that is a new
column plus a reorder UI — not something to fake with `created_at`.

**URLs are normalised on write, never on read.** `schema.ts` prefixes `https://` when the term
has no scheme (people type `drive.google.com/…`) and then rejects anything whose host has no
dot — otherwise a typo like `drive` becomes the perfectly parseable, perfectly useless
`https://drive`. Because the normalising schema is also what `updateExternalLink` re-parses, an
inline edit gets the same treatment as the create form. Anything downstream can assume the
stored value is an absolute URL.

**The link cell is an anchor in read mode and an input in edit mode** — `EditableCell`'s
`display` prop, not a second cell component. It carries `rel="noopener noreferrer"` (the target
document otherwise gets a handle on this window) and `stopPropagation` so following a link never
also fires the row's own click handling.

**No filter bar, on purpose** — it is a short curated list, and the client asked for none. The
query still takes the standard `{ page, pageSize, sortBy, sortDir, filters }` shape and honours
a `title` filter if one arrives in the URL, because that is what makes the shared `<DataTable>`
work in manual mode; only the toolbar is absent, not the contract.

**Mutations are not audit-logged.** `audit_log` (0020) covers tasks; lookup entities — seasons,
key stages, departments — have never been logged, and this follows them rather than becoming the
one lookup that is. If lookups should be logged, that is one decision applied to all of them.

---

## Trash / soft-delete recovery (`/tasks/trash`)

**Soft delete already existed** — `deleteTask` has always set `deleted_at`/`deleted_by` rather
than issuing a real `DELETE`, and every task query filters `deleted_at is null`. What didn't
exist until this pass was a way back: nothing read the other side of that filter. `/tasks/trash`
and `restoreTask` are that other side, not a new deletion mechanism.

- **RLS already allowed this — no migration needed.** The `tasks_select_scoped` policy (0018)
  has no `deleted_at` clause at all; it only gates on active-user/external-participant status.
  A deleted task was always readable by any internal user through the ordinary per-user client,
  simply because nothing queried for it. `listDeletedTasks` (`data/tasks.ts`) is a plain
  `.not("deleted_at", "is", null)` query on the same client `listTasks` uses — not the admin
  client, and not a new policy.
- **`restoreTask` reuses `task.delete`, not a new permission.** Same reasoning as the RLS
  `UPDATE` policy already being shared between delete and restore (both are an `UPDATE` on
  `deleted_at`, never the admin-only hard `DELETE` policy): the people who can remove a task are
  the people who can bring it back. `requirePageAccess("task.delete")` gates the whole
  `/tasks/trash` page the same way, so `canRestore` on the trash columns is always `true` —
  anyone who reaches the page already cleared the gate.
- **`listDeletedTasks` is deliberately NOT a `taskScope()` branch.** Routing the grid's shared
  scope function through an "include deleted" flag would put a parameter whose only real value
  is `false` on every one of `taskScope`'s other call sites, for the sake of one low-traffic
  screen. It's a small standalone query instead — same shape as `listOverdueTasks` — with a
  narrower filter set (task name, season, brand) than the grid: no search-across-relations, no
  owner/participant scoping, no personal scope. A trash is browsed rarely and doesn't need the
  two-pass machinery the ~800-row active grid carries.
- **Restoring never touches `google_event_id`/`google_calendar_owner_id`.** A task's Google
  Calendar event is best-effort deleted alongside it, but `upsertTaskCalendarEvent`'s own
  fallback (`lib/google/calendar.ts`) already recreates the event if the stored id 404s on
  Google's side — so a restored task's stale event id self-heals on its next push/edit rather
  than needing to be cleared here.
- **No permanent-delete action.** Trash only restores. Emptying it, if ever needed, is a
  database operation, not a UI one — deliberate, to keep the one irreversible action in this
  module out of the app entirely.
- **Restore has no confirmation dialog**, unlike delete — it only ever un-hides a row already
  sitting in Trash, so it's a single click, same as the grid's inline-edit confirm.

---

## Task grid search (`/tasks`)

**The search box is one term against the task AND everything it relates to** — its own name, its
season (name *or* code), brand, key stage, and the names of its owners and people involved. It
runs server-side in `listTasks`, so it searches the whole table, not the page on screen.

- **`filters.search` is not a column.** `DataTableToolbar`'s `searchColumnId` is a *filter key*:
  a server-paginated table runs `manualFiltering`, so the key is just a name in the URL's
  `filters` object that the data function interprets. Every other table still passes a real
  column id (`brand_name`, `full_name`, …) and behaves exactly as before. The toolbar reads and
  writes it through `columnFilters` state rather than `table.getColumn()`, which is what allows
  a key with no column behind it.
- **A term takes a two-pass route; no term stays a single query.** The owner/people leg resolves
  to a task-id set that can run to hundreds of uuids, and inlining one into the query's filter
  builds a URL the endpoint rejects — **measured against this project: ~500 ids pass, ~800
  fail** (~18KB works, ~29KB doesn't). So a search reads a narrow
  `id, task_name, season_id, brand_id, key_stage_id` projection, matches in memory, then fetches
  the page's ~15 rows in full. An ordinary page load pays none of that.
- **`taskScope()` is synchronous, and must stay that way.** A PostgREST builder is itself
  thenable, so `await`ing an async function that returned one *runs the query* instead of handing
  it back. That is why the id lookups are resolved up front by `resolveTaskScopeIds()` and passed
  in — which also stops a search resolving them twice.
- **`.order("id")` is a correctness fix, not decoration.** Due dates repeat heavily across 794
  tasks; without a total order, tied rows can come back in a different sequence per query, which
  lets a row appear on two pages or on none — for ordinary pagination as much as for the search's
  two passes. Verified by paging a 364-row result set: 364 distinct rows, no gaps, no duplicates.
- **Terms are sanitised before they touch an `.or()` string** (`sanitiseOrSearchTerm` in
  `lib/utils.ts`, shared with `data/parties.ts` and `data/task-participants.ts`). Commas and
  parens are PostgREST filter syntax; a term containing them would corrupt the query or smuggle
  an extra condition into it. `.ilike()` binds its argument and needs no such treatment.
- **The brand leg deliberately ignores `status`.** `listBrandOptions` returns active brands only,
  but a task can belong to a brand since deactivated and must still be findable by its name.
- **One matcher serves both search boxes.** `data/task-search.ts` owns the projection
  (`TASK_SEARCH_SELECT`) and `resolveTaskSearchMatcher()`; `/tasks` and `/timeline` both run it,
  so the two can't drift into matching different fields. Adding a leg is one edit there.
- **The narrow pass is unbounded.** It reads every row matching the dropdown filters (794 today)
  and would hit PostgREST's 1000-row ceiling **silently** past that. If the table grows, move the
  matching into SQL — a view with a concatenated search column, or an RPC — rather than letting
  the ceiling truncate results.
- **`filters.task_name` still works** as a plain name-only `ilike`, so any existing deep link
  keeps its meaning. `/my-tasks` still uses it; only `/tasks` was switched to `search`.

### Export (`tasks/export/route.ts`, `tasks-export-button.tsx`)

Same Route-Handler-plus-dialog shape as the Dashboard's export (see that module's own section)
but scoped to this page's single dataset — there's no "sections" checklist, only a column
checklist, because Task Management has exactly one table to export.

- **Reads the grid's live URL state, not a re-derived scope.** The button calls
  `useDataTableQueryState(TASKS_QUERY_STATE)` — the same hook `tasks-board.tsx` uses — and
  forwards `filters`/`sortBy`/`sortDir` straight to the route. A second, independent
  `useQueryStates` reading the same URL is the intended nuqs pattern here, not a state-sync bug:
  there is exactly one source of truth (the URL), so the button and the board can't disagree.
- **`filters.search` now works in an export, unlike the Dashboard's.** `listTasksForExport()`
  (`data/tasks.ts`) follows `listTasks()` onto the two-pass route when a search term is present
  — see `exportSearchMatches()` — matching against the WHOLE scope's narrow projection (not
  paginated) rather than one page, then hydrating up to `MAX_EXPORT_ROWS` matches to full rows.
  Same unbounded-narrow-pass caveat as live search applies (see above): past ~1000 candidate
  rows PostgREST's page ceiling silently truncates the search, independent of the export's own
  `MAX_EXPORT_ROWS` cap.
- **Owner/People Involved filters are honoured too** — `resolveTaskScopeIds()` runs unconditionally
  now, where the first cut of `listTasksForExport()` hardcoded `{ participants: null }` (that was
  correct only for the Dashboard's unfiltered, grid-filter-free caller; it silently ignored an
  active Owner filter for anyone else).
- **`countTasksForExport()` mirrors the same rules** (participants + search) for the same reason
  it exists — a future "N tasks will be exported" preview must agree with what the export
  actually returns — but nothing calls it yet; it isn't wired into the dialog.
- **`TASK_RECORD_COLUMN_GROUPS` lives at `tasks/export/task-record-columns.ts`**, not under either
  page's own folder, because both this page and the Dashboard's export dialog import it — see the
  file's own header note before moving it again.
- **Same permission as the Dashboard export** (`dashboard.export_reports`, checked via
  `requirePermission()` in the route and hidden client-side via `can()` in `page.tsx`) — one
  capability governs "can this user pull data out of the platform as a file" everywhere, rather
  than a second grant per page that happens to add an Export button.

---

## Saved views (`/tasks`, `saved_views` table)

**A saved view is a verbatim snapshot of the URL, not a re-resolved query.** `createSavedView`
stores exactly `filters`/`sort_by`/`sort_dir` as the toolbar produced them — season/brand/owner
ids and all — and applying one later is a plain `Link` built by `dataTableSearchParamsHref`, the
same helper the Dashboard's Overdue tile uses. There is no second "apply a view" code path to
keep in sync with ordinary filtering, but the flip side is that **nothing re-validates a saved
view's contents when it's applied.** If a season/brand/key-stage/owner referenced by an old saved
view is later deleted, applying that view just filters to zero matching rows — same as
hand-editing the URL to reference a stale id — rather than erroring or dropping the dead filter.
Not fixed; accepted the same way a dead deep link would be.

**One profile, one namespace — `unique (profile_id, name)`.** `createSavedView` maps the
resulting `23505` to a friendly "You already have a view named …" rather than surfacing the raw
constraint error. There's no rename action; deleting and re-saving under a new name is the only
path, since v1 has no edit flow for an existing view's filters either (see below).

**Saving is gated on `task.view`, not a manage-level action.** A saved view is a personal
bookmark of the grid the viewer already has open, same reasoning as `reminder_rules` being gated
on `profile.update_own` rather than an admin action — every role that can see `/tasks` at all
(including `external`, scoped by RLS to their own tasks) can save and re-apply their own views.

**No "update this saved view" — only save-as-new and delete.** `createSavedView` always inserts;
re-saving under a name that already exists just hits the unique-constraint error above rather
than overwriting. Changing what a saved view points at is delete-then-resave under the same name,
not an edit-in-place. Acceptable for v1's scope; a real "update" would need `createSavedView` to
accept an optional id and do an upsert instead of a plain insert.

**Scoped to the Tasks grid only — `saved_views` deliberately has no `page`/`entity` column.**
Tasks is the one spreadsheet-style view this was built for (`plan.md` §4's original `saved_views`
sketch). If a second table wants the same feature, that's a real second consumer and the point at
which a discriminator column earns its place — not before.

---

## My Tasks (`/my-tasks`)

**Every person sees only their own work, with no role exemption** — an admin scoped this way
gets their own list, not the organisation's. The scope is `scopeToProfileId` on `listTasks()`,
via the `listTasksForProfile()` preset, and "theirs" is the union of three things:

1. tasks they **created** (`tasks.created_by`),
2. tasks they are an **owner** of, and
3. tasks they are **People Involved** on,

where 2 and 3 count whether they are named directly **or through their department** — the
`task_participant_profiles` view (0015) flattens department membership down to profiles. That
last part is doing nearly all the work in practice: the client's export names a department as
owner on 832 of 833 rows, so almost nobody is named individually. A profile with **no
department** typically resolves to only a handful of tasks (whatever names them directly, plus
whatever they created) — if someone reports a near-empty My Tasks page, check their department
before looking at the query.

**Deliberately has no due-date floor.** Earlier this page was "Upcoming Tasks" and hard-filtered
to `due_date >= today` (an `onlyUpcoming` param on `listTasks()`/`taskScope()`); that filter has
been removed from the codebase entirely — created/owned/involved tasks show up whether their due
date is in the future, the past, or unset, and so does every consumer of `listTasksForProfile()`,
including the reminder-rule task picker (see the Reminders section below — it composes the
same underlying query, so it dropped the floor along with the page). The "Due" toolbar filter
(7/30/90 days) is a separate, user-driven narrowing layered on top via `filters.due_date`,
unrelated to that removed floor.

**The scope is applied in memory, not as a filter, and that is a fix rather than a shortcut.**
It is a union of a column check (`created_by = me`) and a join-table id set, which PostgREST
can't express in one clause. The previous version inlined that id set as `.in("id", [...])` —
already 391 uuids (~14.5KB of URL) for one real user here, against a measured ceiling of ~500
ids / ~18KB on this project. It worked, but a larger department or a bigger table would have
started failing the request outright. Now the narrow two-pass path (see the task grid section)
carries it: match over a narrow projection, fetch only the page in full.

**`created_by` earns its place even though it currently adds nothing.** No row in the seed data
was created by someone who isn't also a participant on it, so the leg matches 0 extra tasks
today — it exists so a task someone raises and then hands to another department doesn't vanish
from the raiser's own list.

**Its search box is still task-name-only** (`searchColumnId: "task_name"`), unlike `/tasks`,
which searches across relations. Not an oversight — it was left alone deliberately; switching it
is one line (`"search"`) if the same behaviour is wanted here.

---

## Logs / audit trail (`/management/logs`)

**The `tasks` tracking columns are not an audit trail and never were.** `created_by`,
`last_edited_by` and `deleted_by` hold the *latest* actor per row — they can't answer "who moved
this due date on 12 Aug, and what was it before", and an owner change doesn't touch `tasks` at
all (it writes `task_participants`). `audit_log` (0020) is the history; those columns stay
exactly as they are and are still what the task grid reads.

**Values in `changes` are display labels resolved at WRITE time, not ids.** A season change is
stored as `Winter 2026 → SS26`, not two uuids. Two reasons: reading a log row never needs a
second round trip to become legible, and a label captured then still tells the truth after that
season is renamed or the brand it named is deleted. The cost is one lookup per changed FK field
per edit (`formatTaskValue` in `tasks/_audit.ts`) — only for fields the patch actually changed,
so a typical single-cell inline edit pays nothing extra.

**One confirmed save is one log row, across both participant roles.** The drawer's Save writes
owners and people involved together (`setTaskParticipants`), and `logParticipantsChanged` records
a single `task.participants_change` entry whose `changes.parties` holds one section per role
touched. Splitting it back into `task.owner_change` + `task.people_change` — or logging per
add/remove — is exactly the confusion this replaced.

**`updateTask` reads the task before writing it.** That extra round trip exists solely for the
diff; if you're tempted to remove it, the log loses every "from" value. Nothing else needs it.

**A patch that changes nothing writes no entry.** `diffFields` compares before formatting, and
treats `null`/`""`/`undefined` as the same "not set" (form fields submit `""` where columns store
`null` — see `normaliseDate`/`normaliseOptionalId`). Re-saving an untouched form is not an event.

**Logging is best-effort and must stay that way.** `recordAuditEvent` swallows its own failures:
a log insert must never fail or roll back a mutation the user already saw succeed. The log can
therefore under-record; it can't over-record, and it can't misattribute — 0020's insert policy
pins `actor_id` to `auth.uid()`, and the write goes through the caller's own RLS-scoped client.

**Append-only is enforced in the database, not the UI.** 0020 grants select and insert policies
and deliberately no update or delete policy, so nothing holding `authenticated` can rewrite
history. Don't "fix" that by adding one — the detail dialog is read-only for the same reason.

**`admin.view_audit_log` is its own capability, not part of `admin.manage_users`.** The log spans
every entity and every actor in the organisation, so granting it is a deliberate decision rather
than something that rides along with editing a user's department. RLS mirrors it: select is
`is_admin()`-only, unlike the usual `using (true)` read policy.

**The Period filter stores a keyword, not a date.** `today`/`7d`/`30d` are resolved to a cutoff
server-side in `data/audit-log.ts`, so a shared or bookmarked URL keeps meaning "the last 7 days"
instead of freezing the range it was copied at.

**The Person filter lists every profile, not just actors present in the log.** PostgREST has no
`DISTINCT`, so the alternative is pulling every log row back to populate a dropdown. Someone with
no entries filters to an empty list, which reads fine.

**Rows created by the 0020 backfill carry `{ backfilled: true }` and no field detail** — `tasks`
records that an edit happened, not what changed. The UI says so explicitly rather than rendering
an empty diff, which would imply nothing was touched. Backfilled update entries are also one per
task at most: `updated_at` only remembers the last edit.

**`entity_id` has no FK, on purpose.** Tasks are soft-deleted today, but a hard delete must not
cascade away its own history. Log rows resolve by `entity_label` (the name at the time), not by
join — which is also why a renamed task's older entries show the old name, and should.

**Participant actions live in `tasks/_participant-actions.ts`, not `_actions.ts`.** Same feature,
but the split keeps both files readable; `participantRows()` moved to `lib/party.ts` because a
`"use server"` module can only export Server Actions, so the two files can't share a helper.

---

## Data tables (`components/data-table/`)

**Columns are relatively-weighted, not content-sized, and the table always fills its container.**
Each column declares `meta.width` from the five-step scale in `column-widths.ts` (defaulting to
`md`); `DataTable` converts those into percentages that sum to 100 and emits them as a
`<colgroup>`, with the `<table>` itself set to `w-full`/`table-fixed`. This is a deliberate
reversal of the previous fixed-pixel-sum behaviour (table sized to exactly the sum of its
columns' px widths, scrolling below that and leaving a gutter above it) — client feedback wanted
every table to fill the screen with no gutter AND no horizontal scrollbar regardless of column
count, which a fixed-sum layout can't do at both ends simultaneously. Percentages solve both: a
short table (e.g. Seasons, ~5 columns) stretches every column proportionally to fill the page, and
a wide one (e.g. Tasks, ~13 columns) proportionally compresses every column to still fit on one
screen — same mechanism, no column-count threshold anywhere in the code. The trade-off, accepted
deliberately: a table with many columns runs tighter than any single column would like — pick the
`width` kind for the *typical* value regardless, truncation covers the rest. Adding a column
without a `width` silently gets `md`, which is usually wrong for a badge or a count.

**Manual column resizing is the one opt-out from the weighted-percentage system, and Tasks is
the only table using it — but it renders IDENTICALLY to a non-resizable table until the person
actually drags a column.** `<DataTable enableColumnResizing resizeStorageKey="...">` composes
TanStack's `columnSizingFeature`/`columnResizingFeature` (added to the shared `dataTableFeatures`
in `table-features.ts`, but inert for every other table — nothing reads `getSize()`/renders a
resize handle unless `enableColumnResizing` is passed) and always renders a drag handle on each
`<TableHead>`'s right edge, but the WIDTH MODEL only switches over once `columnSizing` state is
non-empty (`DataTable`'s own `isResized = enableColumnResizing && Object.keys(columnSizing).length
> 0`). Untouched: `column-widths.ts`'s percentages-summing-to-100, `w-full`, single-line truncated
headers — the exact same render path a non-resizable table uses. Resized: real pixel widths
(`column.getSize()`, seeded from each column def's own `size`/`minSize`, not `meta.width`), `<table>`
drops `w-full` so it can exceed the container (`[data-slot="table-container"]`'s existing
`overflow-x-auto`, from the shadcn `Table` primitive, is what turns that into a horizontal
scrollbar rather than an overflow bug), and headers wrap up to 3 lines at a smaller size instead
of truncating. This is a deliberate two-state design, not a compromise: seeding "equivalent"
pixel widths from a live-measured container up front was considered and rejected — it can only
match the percentage layout at one specific viewport width, still needs the same width-model
switch on the very first resize, and adds real flash-of-wrong-size risk for zero benefit over
just reusing the untouched render path exactly. The trade-off actually paid: the very first drag
"jumps" from the column's rendered (percentage) width to its declared `size`/`minSize` before
tracking the pointer from there — a one-time, self-correcting blip, not a persistent difference.

**Resized widths persist to `localStorage`, not the database.** Keyed by `resizeStorageKey`
(`"tasks-column-widths"` for Tasks) — a per-browser, per-device preference, seeded synchronously
in `useState`'s initializer (not an effect) so a return visitor's reload goes straight to pixel
mode with their last widths, rather than flashing the untouched percentage layout for one frame
first. Wrapped in try/catch on both read and write: private browsing or a blocked storage API
throws on access, not just on read, and the table still has to render (falling back to "not yet
resized") either way.

**Whether a resizable table has actually been resized yet is reported back to its own column
defs via a callback prop, not re-derived from the TanStack table instance a header render
function receives.** `DataTable`'s `onResizedChange` fires whenever its `isResized` boolean
changes; `tasks-board.tsx` tracks that in a plain `useState` and passes it into
`createTaskColumns({ isResized })`, which closes over it for every `<DataTableColumnHeader ...
wrap={isResized} />` call. The seemingly more direct route — reading `table.getState().columnSizing`
(or `.state.columnSizing`) from inside a `header: ({ column, table }) => ...` render function —
doesn't type-check in this TanStack v9: state here is atom/store-backed, not a plain synchronous
property, and the `table` a header callback receives is typed narrower than the `ReactTable`
instance `DataTable` itself holds. The callback sidesteps that entirely with an ordinary React
value.

**`wrap` fixes a real conflict inside `DataTableColumnHeader`, not just a cosmetic add-on.**
Setting `whitespace-normal`/`line-clamp-3` on the parent `<TableHead>` alone does nothing for any
*sortable* column — `DataTableColumnHeader` renders its own `<span className="truncate">` (or
`"block truncate"` for a non-sortable title) inside that cell, and a descendant's own explicit
`white-space` always wins over an ancestor's. Its `wrap` prop swaps that for `line-clamp-3
whitespace-normal` and switches the sortable `Button` to `h-auto items-start` so a 3-line label
doesn't render vertically centered against a squashed row. Every `<DataTableColumnHeader>` call in
`tasks/columns.tsx` passes `wrap={isResized}`; every other table's calls don't pass it at all
(defaults to `false`, truncating) — `wrap` has to be threaded per call site (the header render
function is supplied by each `columns.tsx`, not something `DataTable` can inject a prop into
after the fact), so a new resizable table must remember to wire its own `isResized` through the
same way.

**Cells clip, so pick the width for the typical value, not the longest one.** `td`/`th` carry
`truncate`; anything that doesn't fit ellipsises. `showTitleWhenTruncated` (on `onMouseEnter`)
puts the cell's *rendered* text in a native `title` when, and only when, it's actually clipped —
rendered text rather than `cell.getValue()`, because the value behind a formatted date or a badge
is an ISO string or an id and would be worse than useless in a tooltip.

**Every body row must keep an opaque background.** Sticky columns (`meta.sticky`, currently the
Actions column on tasks/seasons/brands/key-stages/users/teams) paint `bg-inherit`, so they take
the row's colour — which only hides the cells scrolling underneath if that colour is fully
opaque. `DataTable` sets `bg-card` on every row for this; a `getRowClassName` tint replaces it
via tailwind-merge and so must also be opaque. That's what `bg-surface-overdue` /
`bg-surface-selected` in `globals.css` are: `color-mix`ed, pre-flattened-over-card versions of
what used to be `bg-status-overdue-soft/40` and `bg-primary-tint/40`. Same reason the header row
uses `bg-surface-header` instead of `bg-muted/40`.

**Hover and selected are re-stated on the sticky cell.** They live on the `<tr>`, which paints
*below* the sticky `<td>`, so `bg-inherit` alone would freeze the pinned column at the row's
resting colour. `DataTable`'s rows carry `group` and the sticky cell carries
`group-hover:bg-surface-hover group-data-[state=selected]:bg-muted` to follow along.

**A `multiple: true` toolbar filter still stores one plain string, not an array.** The selected
option values are joined with `MULTI_FILTER_DELIMITER` (`constants/data-table-filters.ts`,
currently `,`) into the same `filters[columnId]` slot every single-select filter uses — chosen
deliberately over widening `filters` to `Record<string, string | string[]>` in
`data-table-search-params.ts`, since that type is shared by every list page in the app (seasons,
brands, users, holidays, …) and widening it would have forced every one of their `data/*.ts`
functions to accept an array they never actually receive. IDs are uuids or `kind:uuid` party keys
(`lib/party.ts`), neither of which can contain a comma, so the join/split is unambiguous. The
Tasks grid (`tasks-board.tsx`) is the one table using it so far — `data/tasks.ts`'s `applyMultiEq`
and `data/task-participants.ts`'s `taskIdsForAnyParty` decode it back into a list and apply
`.eq`/`.in` (or a unioned `.or()` for the participant-based Owner/People Involved filters).
Selecting several values within one filter is a union (OR); different filters still intersect
(AND) — picking two Seasons and one Brand means either season, and that brand.

**The filter row is a separate component (`data-table-filter-row.tsx`) and needs the sticky
classes applied by hand.** It doesn't go through the header/body cell paths, so it calls the
shared `getStickyCellClassName` itself — forget it and the Actions filter cell scrolls away
while the rest of the row slides under the pinned header above it.

**The sticky divider is scroll-state-driven, which is why `DataTable` measures the scroll
container.** A column parked at its own edge (or a table with no overflow) sits flush with the
row, where a border reads as a stray line — so `useTableScrollEdges` watches `scrollLeft` and
the border only colours in once cells are actually passing underneath. Two consequences: the
border is always present but `border-transparent` at rest, so toggling it can't shift the layout
by a pixel; and the hook finds the scroll container by `data-slot="table-container"` because
that element belongs to the shadcn `<Table>` primitive, not to us. Renaming that slot silently
disables the effect — there's nothing to throw.

## Board / DPSP Flywheel / Timeline (three separate pages, not tabs)

**Tasks, DPSP Flywheel and Timeline each have their own sidebar entry** (`constants/nav.ts` —
"DPSP Flywheel" and "Timeline" sit directly under "Dashboard", client-requested placement;
"Tasks" stays further down with My Tasks). They were originally one collapsed "Tasks" link with
a shared tab strip (`components/shared/critical-path-tabs.tsx`) rendered at the top of all three
pages for lateral navigation between them; both the collapsing and the tab strip were removed
once each got a direct sidebar link, since keeping the strip would have meant every page also
carrying a "Board" tab back to a route the sidebar already links to directly. `activePrefixes` on
`NavItem` (`constants/nav.ts`) is unused as of this split — it existed for exactly this
collapsed-link case — but left on the type for the next section that needs it. Each page remains
a genuinely separate route with its own query state, filters and data fetch; nothing was ever
shared between them beyond that now-removed tab strip. Add a new page in this family with its
own `constants/nav.ts` row like any other page — there's no shared tab component to extend
anymore.

## DPSP Flywheel (`/dpsp-flywheel`)

**`tasks.dpsp_category` is optional and single-valued** (`task_dpsp_category` enum: demand /
product / sales / profit, `0023_tasks_dpsp_category.sql`). A task with no category simply never
appears on this board — it's an additional lens over the same task, not a required
classification like `status`/`gender`. Editable the same way as Key Stage (an inline-select grid
column + a task-form field, "none" sentinel normalised to `null` in `_actions.ts`).

**One bounded fetch, grouped into columns in the browser — not four separate queries.**
`listTasksForFlywheel()` (`data/tasks.ts`) fetches every non-null-category task matching the
toolbar's filters in one shot (capped at `MAX_FLYWHEEL_ROWS`, 1000 — the client's live dataset
is a few hundred, so this is a safety valve, not a real limit) and the workspace groups the flat
array into the four columns with `useMemo`. This was chosen over four
`listTasks({filters:{dpsp_category}})` calls because a shared search term and the four column
counts have to agree with one result set.

**Each column paginates client-side, not server-side.** `DpspFlywheelColumn` holds its own
`page` state and slices its category's already-in-memory array at
`DPSP_FLYWHEEL_COLUMN_PAGE_SIZE` (25) using the shared `<PaginationControls>` — there's no
per-column server round trip, since the whole board's data is already sitting in the browser
from the one bounded fetch above. The column header's count is always the category's TOTAL
(`tasks.length`), never the current page's — that's what keeps "DEMAND · 92" accurate while
only 25 cards render. A column's `page` resets to 1 whenever its `tasks` array changes, via
setState-during-render (React's documented pattern for "reset state when a prop changes" —
comparing `tasks` against a mirrored `tasksForPage` state and resetting both in the same render),
deliberately not a `useEffect` — CLAUDE.md's "no useEffect for derived state" rule, and the
lint rule (`react-hooks/set-state-in-effect`) both rule that out here. Otherwise a
season/department/search change that shrinks a category below its previous page count would
render an empty column instead of jumping back.
This was chosen over real (server) pagination because the whole point of the single bounded
fetch above is that a shared search term and the four columns' counts can't drift apart; paging
one column server-side would reintroduce exactly that problem.

**Category pills are display-only, not a server filter.** Toggling Demand/Product/Sales/Profit
in the toolbar hides/shows that column client-side (`visibleCategories` state in
`dpsp-flywheel-workspace.tsx`); it does not change which tasks are fetched, and is deliberately
not persisted in the URL (unlike season/department/search/hide-done, which are). All four
columns' counts and the diagram's stats always reflect the full filtered set, regardless of
which columns are currently hidden.

**The department filter reuses the Owner-filter machinery, not a new column.** There's no
`tasks.department_id` — a task's department is one of its `task_participants` owners. The
toolbar's department picker maps a department id to an `owner` filter value (`department:<uuid>`
party key, see `lib/party.ts`) and `listTasks()`/`listTasksForFlywheel()` resolve it exactly the
same way the Tasks/Timeline "Owner" filter already does (`participantTaskIds()`).

**"Hide done" is its own filter key (`filters.hide_done === "true"`), not a `status` equality
filter** — it's an exclusion (`status != completed`), which the existing `status` filter can't
express (that one is "show only this status").

**Skipped for this pass, deliberately:** the "Show target-state" toggle and "Connect sheet"
(Google Sheet sync) from the client's original mockup — both would need new data-model concepts
(a target-state/gap deliverable; an external sheet connection) and were scoped out rather than
half-built. If either lands later, it's a new column/table plus real UI, not a toggle bolted onto
the existing board.

## General Settings (`/settings/general`)

**Fully read-only.** Client decision: users should not be able to edit their own display name.
Name joined email/role/department as a disabled input rendered by `profile-details.tsx`
(`ProfileDetails`, a plain presentational component — no react-hook-form, no schema, no Server
Action; there's nothing left on this page to submit). An admin can still change a user's name,
via `/management/users` (`user-form.tsx`).

**App layer only, deliberately.** The old `updateOwnProfile` Server Action and
`profileUpdateSchema` were deleted outright rather than left unused — that's what actually
removes the capability, since it was the only path to a self-service name edit. `full_name` is
NOT in `enforce_profile_column_permissions()`'s guarded column list the way
`role`/`status`/`department_id`/`google_group_id` are — a direct DB write to your own
`full_name` would still succeed. Client call: app-layer removal is enough here, no DB trigger
needed.

## Reminders (`/settings/notifications`, `data/reminders.ts`, `/api/cron/task-reminders`)

**Self-service, not an admin rule.** `reminder_rules` is one row per profile, configured by that
person on the two cards on the Settings → Notifications page (moved out of My Tasks; the whole
implementation — `notify-timing-card.tsx`, `notify-tasks-card.tsx`,
`notify-task-picker-dialog.tsx`, `reminder-schema.ts`, `_reminder-actions.ts` — now lives under
`app/(app)/settings/notifications/`) — there is no admin-facing management screen, and
`plan.md`'s original org-wide `reminder_rules` sketch is superseded by this, not implemented
alongside it. Every Server Action here is gated on `profile.update_own` (already granted to
every role, admin included) rather than a new `Action` — this isn't a distinct capability
decision, it's "manage your own settings," same as the profile itself. Because of that, the
`Email notifications` sidebar entry (`constants/nav.ts`) deliberately carries no `requiredAction`
unlike the rest of the Settings group (which is `admin.manage_lookups`-gated) — it must stay
visible to every role, including `external`.

**Scope is specific tasks only — v1 deliberately dropped "by season"/"by owner" as separate
scope types.** `reminder_rule_tasks` is a plain join (`rule_id`, `task_id`); season and owner
are filters *inside* the "Select tasks…" picker (`notify-task-picker-dialog.tsx`), narrowing
which of the user's own tasks they pick from — not a second matching mechanism a task could
qualify under independently of being explicitly chosen. The picker's candidate set is
`listMyReminderCandidateTasks()`, which is just `listTasksForProfile()` — the exact same
created/owned/involved scope as the My Tasks page, no due-date floor. A task with no due date,
or one already overdue, can be selected same as any other; nothing crashes, it just never
actually fires — `listDueReminders()` skips any `reminder_rule_tasks` row whose task has
`due_date is null` before computing offsets, so an undated pick is inert rather than invalid.

**"Select all" / "Deselect all" in the picker act on different scopes, on purpose.** Select all
only selects what's currently loaded into `candidates` — i.e. whatever the picker's own search/
season/owner filters and the `CANDIDATE_PAGE_SIZE` (100) cap currently show — so it composes
with those filters instead of silently grabbing the user's entire task list. Deselect all clears
the whole selection regardless of what's currently filtered into view, mirroring what Save would
otherwise persist — an honest "start over," not a scoped removal.

**Offsets are one `integer[]` column, not three preset booleans plus a custom field.**
`reminder_rules.offset_days` holds every "notify N days before due_date" value the user has
turned on — the three UI presets (2/1/7) and any custom value they add are indistinguishable
once stored; the UI (`notify-timing-card.tsx`) just partitions the array into "known presets"
vs. "everything else" for display.

**One fixed org timezone (`REMINDER_ORG_TIMEZONE` = `Australia/Sydney`), not per-user.** The
client operates out of one region — there's no per-user timezone field anywhere in the app, and
adding one just for this would be scope no one asked for. If that ever changes, this constant in
`data/reminders.ts` is the one place to touch.

**due_date arithmetic must NOT go through the org timezone — only "what time is it right now"
should.** `due_date` is a bare calendar date with no attached timezone; "3 days before" is pure
calendar-date subtraction (`subtractCalendarDays()`, via `date-fns` on `parseDateOnly`'s
local-midnight `Date`). Reformatting that result through `Intl.DateTimeFormat` with an explicit
IANA zone — which IS correct for turning `now` (a real instant) into "what day/hour is it in
Sydney" — would risk shifting the calendar day depending on what timezone the Node process
itself happens to run in. Keep these two operations (`subtractCalendarDays` vs.
`hourInOrgTimezone`/`isoDateInOrgTimezone`) conceptually separate; an earlier draft of this file
conflated them and silently mis-dated reminders near a UTC day boundary.

**Matching is a JS scan over a bounded fetch, not a SQL query with `unnest()`.** `listDueReminders()`
pulls every enabled rule (already filtered to `notify_hour = current hour` at the DB level) with
its tasks, then loops over each rule's `offset_days` array in TypeScript checking
`due_date - offset == today`. At the client's actual scale (a few hundred tasks, presumably a
handful of active rules) this is simpler to read and maintain than the equivalent SQL, and
`MAX_DUE_REMINDERS_PER_RUN` (500) is the safety valve if that assumption ever stops holding.

**Dedupe is a real unique constraint, not just an in-memory guard.** `notifications_log` has
`unique(rule_id, task_id, offset_days)`; `listDueReminders()` filters candidates against it as
an optimisation (so one run doesn't even try to re-send within itself), but
`recordReminderSent()`'s `upsert(..., { ignoreDuplicates: true })` is what actually makes two
overlapping/retried cron runs safe. A failed send is deliberately left un-logged — the next tick
(still the same hour, since the cron runs every 15 minutes) retries it; only after the whole
matching hour passes without a successful send does that day's reminder silently not go out.

**SMTP is optional at runtime, not a hard dependency of the cron route.** `getSmtpEnv()`
(`env.server.ts`) returns `null` rather than throwing when `SMTP_*` is unset — same shape as
`getGoogleServiceAccountEnv()` — so `sendMail()` returns `{ sent: false }` instead of attempting
a real send, and the route counts it as `skippedNoSmtp` rather than `sent` or `failed`. This is
what let the cron/pg_cron wiring and the matching logic be stood up and verified before the
client's Workspace SMTP relay was provisioned.

**`SMTP_HOST` is `smtp.gmail.com`, not `smtp-relay.gmail.com`, despite the "Workspace SMTP
relay" language elsewhere in this doc and in CLAUDE.md's stack list.** The client provisioned
a mailbox (`techsupport@threebyone.com.au`) + Google App Password, which is direct Gmail SMTP
submission credentials, not Workspace SMTP Relay service credentials — the two are different
products. Pointing them at `smtp-relay.gmail.com` authenticates fine (`transport.verify()`
passes) but every real send bounces with `550 5.7.1 Invalid credentials for relay [<ip>]`,
because that service also gate-checks the sending IP/domain against the admin console's
"Allowed senders" config, which isn't set up for this. `smtp.gmail.com` skips that check
entirely since it's authenticating as the mailbox itself. If the client ever wants to send
through the relay service instead (e.g. to send-as multiple domain addresses from one config),
that requires a Workspace admin to open it up in Admin Console → Apps → Google Workspace →
Gmail → Routing → SMTP relay service first — it is not a code-side fix.

**Real `SMTP_*` creds are now live (`techsupport@threebyone.com.au` via `smtp.gmail.com`).**
The testing-only shortcut that used to log a `skippedNoSmtp` reminder to `notifications_log` as
if it had sent (so a "would-have-sent" reminder was visible in Supabase before the relay was
provisioned) has been removed from `app/api/cron/task-reminders/route.ts` — the `!result.sent`
branch is a plain `continue` again. Any (rule, task, offset) rows that got logged that way before
this fix will **not** retry on their own: the dedupe log already thinks they're done. Check for
leftover rows with `select * from notifications_log where <timestamp before the fix>` and delete
any you want to actually go out for real; new rows only get logged on a genuine send from here on.

**Completed or soft-deleted tasks never get reminded about**, checked in `listDueReminders()`
itself (`status = 'completed'` or `deleted_at is not null` excludes the candidate) — a reminder
about finished work is noise, not signal.

**The trigger is Supabase `pg_cron`/`pg_net`, not Vercel Cron** — the project stays on Vercel's
free plan, which caps its own Cron Jobs at once a day regardless of the configured schedule.
`pg_net`'s `net.http_post` is fire-and-forget (Postgres doesn't wait for the route to finish) and
logs each call's response in `net._http_response`, useful for debugging a silently-failing run.
**The actual `cron.schedule(...)` registration is a manual, one-time SQL Editor step — it is
NOT part of the checked-in migration**, because it embeds an environment-specific URL and the
`CRON_SECRET` value, neither of which belongs in git history. Run this once per environment
(dev/staging/prod each need their own, pointed at their own deployed URL):

```sql
select cron.schedule(
  'task-reminders-every-15-min',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := 'https://YOUR-DEPLOYED-DOMAIN/api/cron/task-reminders',
    headers := jsonb_build_object('Authorization', 'Bearer ' || 'YOUR_CRON_SECRET_VALUE'),
    timeout_milliseconds := 15000
  );
  $$
);
```

Requires the `pg_cron` and `pg_net` extensions enabled on the Supabase project (Database →
Extensions) — both are available on the free tier.

**`timeout_milliseconds := 15000` is load-bearing, not padding.** `net.http_post`'s default
timeout is 5000ms, and because this route only gets hit every 15 minutes, the Vercel function is
*always* cold when pg_cron fires it — cold-start latency alone measured 2–5s in production,
putting a stock 5s timeout right on the coin-flip line. Below this value, some runs get marked
`timed_out` in `net._http_response` (status_code `null`) purely from cold-start latency, before
the route's own logic ever executes — indistinguishable from a real hang unless you check
`net._http_response.timed_out`/`error_msg`, not just `status_code`. If the job is ever
re-scheduled from scratch (not `cron.alter_job`'d), carry this value forward.

---

## Integrations / API keys (`/management/integrations`, `/integration/v1/*`)

**Check `/management/integrations/docs` (or `ENDPOINT_DOCS` in `endpoint-docs.ts`) for which
endpoints are actually live — this section named them once, by count, and was stale within one
endpoint; it doesn't try again.** `docs/databricks-integration-api-spec.md` describes ~19 total;
each new one gets built against real columns only, with any genuinely missing field sent as
`null` (see the `version` bullet below — every endpoint sends `null` for it, since no table has
a change-counter column). Three shapes have emerged so far: a **straight column mirror**
(`seasons`/`brands`/`users` — `lib/integration/brands.ts` literally copies
`lib/integration/seasons.ts` field-for-field; `users` additionally needed a join for
`department` and a label map for `role_name`, see its own bullet below), a **real-aggregate
endpoint** (`teams` — `member_count`/`active_tasks_count`/`completed_tasks_count` are computed,
not missing, so they are NOT sent as `null` the way a genuinely absent field is; see its own
bullet below for the dedupe logic that makes that safe), a **one-to-one reshape of a different
table** (`calendar-events` — every `tasks` row, one to one, not a mirror of some
`calendar_events` table that doesn't exist; see its own bullet below), and a **non-paginated
aggregate report** (`reports/tasks-by-season`/`reports/tasks-by-brand` — grouped counts over the
whole table, `{ schema_version, as_of }` meta with no cursor, closer in shape to
`/dashboard-summary` than to the row-level endpoints above). **Before adding another endpoint from
that spec, check whether its fields actually exist as columns (or are honestly computable) first**
— most of the
`tasks` shape in that doc (`blocked_status`, `delay_reason_code`, `is_milestone`,
`planned_*`/`actual_*` dates distinct from `start_date`/`end_date`, `version`, `comments_count`,
`attachments_count`, …) has no backing column, and `task_dependencies`/`delay_reason_codes`/
`task_history_snapshots` don't exist as tables. Returning fabricated or always-null values for a
field Databricks will actually consume is worse than not shipping the endpoint yet — each one is
its own scoping decision (does this need a migration first, or can it honestly map to what's
already there), not a rename-and-ship exercise.

- **Key format is `cpi_` + 32 random bytes (base64url), hashed with SHA-256, never stored raw.**
  `lib/integration-keys.ts`. Deliberately not bcrypt/scrypt — those trade against brute-forcing a
  *low-entropy* human password, and a 256-bit random token has no such weakness; a fast hash
  looked up as an exact indexed match (`.eq("key_hash", …)`) is the correct and standard choice
  here (same pattern GitHub/Stripe tokens use).
- **The raw key is shown exactly once**, in `create-api-key-dialog.tsx`'s "reveal" step,
  immediately after `createApiKey()` returns it. It is never persisted anywhere — only
  `key_hash` (for lookup) and `key_prefix` (first 12 chars, for the admin list to be
  recognisable) survive past that one response. Losing it means revoking and reissuing, not
  recovering — there is nothing to recover from.
- **Revoked, never deleted** — same idiom as deactivating a user or soft-deleting a task.
  `api_keys.status` (`active`/`revoked`) plus `revoked_at`/`revoked_by`; `0025_api_keys.sql` has
  no delete policy at all, so a key's row (and its place in the audit trail) is permanent.
- **`/integration/v1/*` is deliberately NOT in `PROTECTED_PREFIXES`.** That list exists to force
  a Supabase session before `proxy.ts` lets a request through — exactly wrong for a machine
  caller authenticating with an `apikey` header instead. Adding this prefix there would break
  every integration endpoint, not secure it. Read `src/proxy.ts` before assuming a new top-level
  route needs to be added to that list; most of this app's routes do, this one specifically must
  not.
- **`requireIntegrationApiKey()` uses the service-role client** (`lib/supabase/admin.ts`), not
  the per-user one — same reasoning as cron and export routes: the caller has no Supabase
  session, and `api_keys`' RLS is admin-only, so there is no per-user client that could read it
  anyway. `last_used_at` is bumped best-effort in the same call; a failed bump must not turn a
  valid request into a 500.
- **`admin.manage_integrations` is its own permission**, not folded into `admin.manage_users` —
  same reasoning `lib/permissions.ts` already gives for `admin.view_audit_log` being separate:
  granting access to something this sensitive should be a deliberate decision. Once real data
  endpoints exist behind these keys, a leaked one is a standing org-wide read, at least as
  sensitive as the audit log itself.
- **Key create/revoke events land in the same `audit_log` table as task events** (`entity_type =
  "api_key"`, `AUDIT_ACTION.API_KEY_CREATE`/`API_KEY_REVOKE`) — `audit_log` was already built
  entity-agnostic for exactly this (see `0020`'s own comment), so this needed no migration. They
  show up on `/management/logs` alongside task events; the "Task" column header there still says
  "Task" even for one of these rows — a pre-existing generic-log-viewer label, not something
  introduced here, and not worth a rename just for this one new entity type.
- **`X-Request-Id`/`X-Correlation-Id` are echoed, not enforced.** The spec lists them as required
  Kong headers; a request missing either still succeeds — Kong's actual outgoing header set
  isn't confirmed yet, and rejecting on a header this app doesn't otherwise use would be
  guessing at a contract nobody's verified. What's real: `withIntegrationTraceHeaders()`
  (`lib/integration/response.ts`) copies whichever of the two arrived straight onto every
  response, success or error, so a caller can match a response back to the request that
  produced it and correlate against their own sync-run logs. No server-side logging or
  request-log table backs this — `console.log` is barred in production code (CLAUDE.md) and a
  persistence layer for request tracing is its own scope decision, not a two-header echo.
  Enforcing these as hard-required (400 on missing) is a one-line tightening in
  `requireIntegrationApiKey()` if Kong's real config is ever confirmed to always send them —
  don't add it speculatively.
- **`lib/integration-auth.ts`/`lib/integration-keys.ts` were reorganised into `lib/integration/`**
  (`auth.ts`/`keys.ts`) once a second data endpoint was on the horizon, plus two new siblings:
  `cursor.ts` (keyset pagination shared by every list endpoint) and `response.ts`
  (`withIntegrationTraceHeaders`/`integrationError`, the one response envelope every route
  returns). One folder for everything `/integration/v1/*`-specific, so it doesn't sprawl across
  `lib/integration-*.ts` as more entities land. `lib/integration/seasons.ts` (and each entity
  after it) lives here too, **not** in `data/` — every `data/*.ts` file reads through the
  per-user RLS-scoped client by convention, and these read through the service-role client
  instead (the caller has no Supabase session; see `requireIntegrationApiKey`'s own reasoning).
  Mixing an admin-client read into `data/` would break that file-level invariant for anyone
  who copies the pattern.
- **Pagination is real keyset cursor, not the app's usual offset `page`/`pageSize`.**
  `lib/integration/cursor.ts` encodes `(updated_at, id)` as an opaque base64url token; `id`
  breaks ties when `updated_at` repeats (a bulk edit touching many rows in one transaction),
  same reasoning `data/tasks.ts`'s own `.order("id")` tiebreak gives for the grid. A cursor that
  fails to decode — garbled, hand-edited, or just old — is treated as "no cursor" (start over),
  never a 500; **but decoding also validates shape** (`updatedAt` must look like an ISO
  timestamp, `id` like a uuid) before either value is interpolated into a PostgREST `.or()`
  filter string — the same discipline `sanitiseOrSearchTerm` applies elsewhere in this codebase
  to keep unvalidated input out of an `.or()`, applied here as validation instead of stripping.
  `clampPageSize()` silently falls back to the spec's default (500) for anything ≤0 or
  non-numeric, and clamps above to the max (2000) — a bad `page_size` degrades the response, it
  doesn't error the request.
- **`version` is always `null` on every endpoint, on purpose, by explicit client direction** —
  this schema has no change-counter column on any table, and rather than add one speculatively
  for a spec field nothing else needs yet, every endpoint sends `null` for it (`/seasons`,
  `/brands`, `/users` all do this today). Follow this same rule for any other spec field with no
  backing column: send `null`, don't invent a value and don't silently drop the key — the
  response shape should still match the spec.
- **`/users` sends `last_active_at` and `deleted_at` as `null` too, for a different reason than
  `version`** — not "no column anywhere," but "no equivalent concept for this entity."
  `profiles` tracks no sign-in timestamp at all, and a user is deactivated (`status`), never
  deleted — mapping `deleted_at` from `status !== 'active'` would misrepresent a deactivation as
  a deletion, so it stays `null` rather than being derived. `include_deleted` is accepted (it's
  in the spec's query param list for this endpoint) but is a no-op for the same reason — there
  is nothing for it to toggle. `role_name` is real data, not a gap: `lib/integration/users.ts`
  reuses `ROLE_LABEL` (`constants/roles.ts`), the same map the UI's own role badges read from,
  rather than re-deriving "Administrator" from "admin" a second time.
- **`/teams` is `departments`, and its three count fields are the first real aggregates in this
  API — worth understanding before copying the pattern to another endpoint.**
  `lib/integration/teams.ts`'s `countTaskStatusesByDepartment()` reads every
  `task_participants` row for the page's department ids joined to `tasks(status, deleted_at)`,
  then dedupes on `department_id:task_id` before bucketing — **without that dedupe, a
  department that is both `owner` and `involved` on the same task double-counts it**, since
  `task_participants` has one row per role, not one row per (task, department) pair. Verified
  against an independent manual query during development (same count, same dedupe key). Soft-
  deleted tasks are excluded, same as every other view of task counts in this app. "Active" =
  not `completed` (there's no third bucket the spec asks for); "completed" = `status =
  'completed'`, the same check `data/dashboard.ts` uses. Both `department` (no two-level
  team-within-department hierarchy exists here) and `lead_name` (no "lead" role exists) are
  `null` — a **different kind of gap** than `member_count`/the task counts, which are real,
  computed data and must never be sent as `null` just because they're not stored columns.
  `status` is derived from `deleted_at` (departments have no separate status column, unlike
  brands/seasons) — a legitimate derivation, unlike `/users`' `deleted_at`, which is NOT derived
  from `status` for the opposite reason (see above) — know which direction is safe to derive in
  before doing it on a new endpoint.
- **`/calendar-events` is `tasks` reshaped one-to-one, not a mirror of a `calendar_events` table
  — no such table exists, and every task is a row whether or not it's ever synced to Google.**
  `lib/integration/calendar-events.ts` queries all of `tasks` (deleted-filtered the same way as
  every other endpoint); a task that's never been synced still gets a row, with
  `calendar_event_id`/`provider`/`sync_status`/`last_synced_at` sent as `null` rather than the
  row being dropped — **client-confirmed direction (2026-09-15): every field in the spec's shape
  is always present, real value or `null`, and that now extends to rows too, not just fields.**
  Before this, the endpoint only returned tasks with `google_event_id` set; changed after the
  client explicitly asked for the full row/column set with nulls filled in rather than entries
  omitted. `sync_status` is `"synced"` only when `google_event_id` is set — never `"failed"` or
  `"pending"` for an unsynced task, for the same reason `/teams`' `department`/`lead_name` are
  `null` rather than guessed at: `lib/google/calendar.ts` swallows a failed push and leaves the
  task's columns untouched, so a failed sync is indistinguishable from one never attempted —
  claiming a third state would be inventing data Databricks would then trust. `provider` is
  `"google_calendar"` when synced, `null` otherwise (it's the only provider integrated).
  `owner_name` reuses the same join-into-one-string idiom as the app's own `partyNames()`
  (`tasks/export/task-record-columns.ts`) — owner is 1..n departments/profiles via
  `task_participants`, not a column, resolved and joined with `", "` the same way the grid's own
  owner column does (departments first, then people, alphabetical). `event_deleted` is derived
  from the task's own `deleted_at`, **not** verified against Google — `deleteTask`
  (`tasks/_actions.ts`) attempts to delete the calendar event best-effort when a task is
  soft-deleted, but swallows a failed attempt like every push does, so a task whose Google-side
  cleanup actually failed still reads `event_deleted: true` here; a never-synced task reads
  `event_deleted: false`, since there was genuinely never an event to delete. `version` is `null`
  like every endpoint. **This full-row/full-column stance is now the standing rule for every
  endpoint still to be built (`/tasks` chief among them)** — the earlier caution in this
  section's own intro paragraph about not shipping a mostly-null `/tasks` was an engineering
  judgment call, not client direction, and the client has since overridden it explicitly.
- **Three report endpoints are live: `/reports/overdue-tasks`, `/reports/tasks-by-season`,
  `/reports/tasks-by-brand`.** All three share code rather than each re-deriving it:
  `lib/integration/task-owners.ts` (owner_name both directions — task→name for display, name→task
  ids for the `owner_name` filter param; promoted out of `calendar-events.ts` once a second
  consumer showed up), `lib/integration/lookup-codes.ts` (`season_code`/`brand_code` → internal
  uuid, since the spec's task-level filters address a season/brand by its stable short code, not
  the id `tasks` actually stores), and `lib/integration/task-group-facts.ts` (the paginated
  whole-table fact-fetch + grouping/counting shared by both `tasks-by-*` reports, same
  page-through-1000-rows shape as `data/dashboard.ts`'s own `listTaskFacts`).
- **`resolveOwnerNames()` (`lib/integration/task-owners.ts`) batches its `task_participants`
  lookup in chunks of 250 ids, not one `.in("task_id", ids)` call** — found the hard way building
  `/reports/task-summary`: called unfiltered over this app's ~800-task dataset, one unbatched call
  produced a query string long enough that the request failed outright (caught by the route's
  generic try/catch and surfaced as a misleading `400 Invalid query parameters`, not a 5xx, which
  is what made it easy to miss in a quick smoke test — always test the *unfiltered* call for any
  endpoint that fans out into a `resolveOwnerNames()` lookup, not just filtered ones with a small
  result set). `/reports/overdue-tasks` was never actually safe here either — it just happened to
  only ever call this with one page's worth of ids (≤ `page_size`, max 2000) instead of a whole
  unfiltered table. Every current caller of `resolveOwnerNames()` (`overdue-tasks.ts`,
  `task-summary.ts`) gets the fix for free; no caller-side chunking needed. (`tasks-by-season.ts`/
  `tasks-by-brand.ts` only call this file's *other* export, `resolveTaskIdsForOwnerName` — the
  `owner_name` filter direction, not the per-task display-name lookup — so they were never
  exposed to this bug in the first place.)
- **`overdue_count`/`status: "overdue"` across all three report endpoints trusts the STORED
  `tasks.status` column — it does not derive "is this task overdue" live from `due_date`.**
  This matters because **nothing in this codebase auto-stamps that status today**: no
  `status-rollover` cron route exists on disk despite CLAUDE.md's cron table describing one (see
  this file's own Tasks section, "Is never overdue" — `calendar-task-chip.tsx` is the one place
  that DOES derive it live, specifically because the calendar view needs same-day accuracy, and
  says so in its own comment). Every aggregate view already in this app makes the same trade
  (`data/dashboard.ts`'s status tiles, `data/tasks.ts`'s `listOverdueTasks`), so these three
  endpoints match the dominant existing convention rather than inventing a fourth, disagreeing
  definition of "overdue." **Practical effect: a task whose due date has passed but whose status
  hasn't been manually changed will not show up as overdue in any of these three endpoints,**
  the same way it wouldn't show up in `/dashboard`'s Overdue tile either. If Databricks' numbers
  need to be accurate rather than merely consistent with the rest of this app, the fix is
  building the missing status-rollover cron — not deriving overdue status differently inside the
  integration layer alone, which would just create a fourth number that disagrees with the other
  three.
- **`days_overdue` (`/reports/overdue-tasks`) is computed live — calendar days from `due_date` to
  today via `differenceInCalendarDays`/`startOfToday()`, matching `lib/dates.ts`'s
  `parseDateOnly` handling for date-only columns (never `new Date(due_date)` directly).** This is
  safe specifically because this endpoint's query params have no `updated_since`/incremental
  contract — it's meant to be re-pulled fresh each time, not walked incrementally by
  `updated_at`, so a value that silently changes day-to-day without the row's own `updated_at`
  moving isn't the trap here it would be on a sync-feed endpoint (`/tasks`, when built, must NOT
  do this same thing for exactly that reason). `null` for a task with `status = 'overdue'` but no
  `due_date` — a data anomaly, not a computable case.
- **`/reports/tasks-by-brand` under-represents totals by design, not bug: `tasks.brand_id` is
  nullable** (plenty of stage work — trend trips, range reviews — isn't brand-specific, see this
  file's Tasks section), so a task with no brand contributes to no group in that report at all.
  Summing every returned group's `task_count` will not equal the total qualifying task count for
  the same filters. `/reports/tasks-by-season` has no equivalent gap — `season_id` is a not-null
  FK, so every task lands in exactly one season group.
- **Neither `tasks-by-season` nor `tasks-by-brand` is paginated** — the spec lists no
  `cursor`/`page_size` for either, matching `/dashboard-summary`'s smaller
  `{ schema_version, as_of }` `meta` shape rather than the cursor-list one every other endpoint
  above uses. Row count is bounded by season/brand count (28 seasons today), not task count, so
  this isn't a cut corner.
- **`/roles` is live, and it's the first endpoint that reads code instead of a table** —
  `lib/integration/roles.ts` maps `constants/roles.ts`'s fixed 4-role `ROLE` enum and
  `lib/permissions.ts`'s allow-list matrix directly, with no `profiles` query except for
  `user_count`. Several fields deviate from the spec's literal shape, each for a reason distinct
  from a genuinely missing column: `role_id` is the role's code (`"admin"`) rather than a UUID —
  there's no synthetic row to assign one to, and faking one that looks like a database id would
  misrepresent this as table-backed. `permission_key` values are this app's own action strings
  (`"task.create"`, `"admin.manage_users"`, …) rather than the spec's illustrative
  `"tasks.create"` — real source data wins over cosmetic conformance to an example the spec's own
  header calls "rough sketches." Per-permission `access_level` is always `"full"`: `can()` is a
  boolean allow/deny, never graded, so anything present in a role's permission list is by
  definition granted in full — not a gap, a provably accurate constant. Role-level `access_level`
  is `"full_access"` **only** when a role's permissions cover every entry in `ALL_ACTIONS` (true
  for admin, verifiably, since `can(ADMIN, x)` short-circuits to `true` for every `x`) — `null`
  for the other three roles, since the spec names no other tier and inventing one (`"partial_access"`
  or similar) would be guessing at a taxonomy nobody's confirmed. `status` is always `"active"` —
  not derived, just true by construction, since a role either exists in the enum or it doesn't;
  there's no deactivation concept the way `profiles.status` has one for users. `updated_at`/
  `deleted_at`/`version` are always `null` — nothing tracks when a role's permission set last
  changed (that's git history, not a column) and roles are never deleted, only ever added in
  code; `updated_since`/`include_deleted` are accepted (the spec lists them) but are no-ops for
  the same reason. **`ALL_ACTIONS` in `roles.ts` must be kept in sync with the `Action` union in
  `lib/permissions.ts` by hand** — TypeScript's own type has no runtime representation, so a
  newly added action silently won't appear in any role's `permissions` array (or count toward
  `access_level`'s "full_access" check) until this list is updated too; there's no automated
  guard against drift here. Pagination uses a dedicated, much simpler cursor than every other
  endpoint's `(updated_at, id)` keyset (`lib/integration/cursor.ts`'s `IntegrationCursor`
  requires a UUID `id` and a real timestamp, neither of which a role has) — a "resume after this
  role code, in a fixed `ROLE_ORDER` array" scheme instead, sized for a dataset that will only
  ever have 4 rows.
- **`/dashboard-summary` is live** — the first endpoint to combine `totals` + multiple
  `breakdowns` in one non-paginated aggregate object (same `{ schema_version, as_of }` meta shape
  as `tasks-by-season`/`tasks-by-brand`, since there's nothing to page through). Reuses
  `lib/integration/task-group-facts.ts`'s `fetchTaskGroupFacts` — the same whole-table fact fetch
  the two `tasks-by-*` reports already use — then buckets the result three ways in
  `lib/integration/dashboard-summary.ts` rather than three separate queries. `overdue_tasks`
  carries the same trusted-stored-status gap as every other aggregate here. **`owner_id` is a
  genuinely different filter than every other endpoint's `owner_name`** — the spec's own param
  name for this endpoint, and it means a `profiles.id` specifically
  (`lib/integration/task-owners.ts`'s `resolveTaskIdsForOwnerProfileId`, a direct equality
  lookup, no name search needed since the caller already has the id). A task owned only by a
  department (Vendor, Supplier, ...) can never match `owner_id`, by design — it's a different
  filter from `owner_name`, not a lesser one. `by_status`/`by_season`/`by_brand` only include
  groups with ≥1 matching task, same "don't zero-fill an empty group" convention the two
  `tasks-by-*` reports use; `by_brand` under-counts against `totals.total_tasks` for the same
  reason `/reports/tasks-by-brand` does (`tasks.brand_id` is nullable).
- **`/reports/task-summary` is live** — same non-paginated single-object shape and gaps as
  `/dashboard-summary` (`lib/integration/task-summary.ts` reuses the same `fetchTaskGroupFacts`),
  plus a fourth breakdown neither `/dashboard-summary` nor the `tasks-by-*` reports have:
  `by_owner`. It groups on the exact same joined `owner_name` string `/reports/overdue-tasks`/
  `/calendar-events` already compute per task via `resolveOwnerNames` (departments first, then
  people, alphabetical, comma-joined) — a task with two owners is its own bucket
  ("Product Development, Vendor"), not split across two buckets, since that's how `owner_name`
  reads everywhere else in this API. A task with no owner participant at all is skipped from
  `by_owner`, same "omit rather than zero-fill" convention the other breakdowns already use for
  an empty group. **This endpoint's `owner_name` filter is a different shape than
  `/dashboard-summary`'s `owner_id`** — department-or-person by display name
  (`resolveTaskIdsForOwnerName`), not a `profiles.id`-only equality lookup — match whichever one
  a new endpoint's own spec section actually names, they're not interchangeable.
- **`/changes` is live** — the first endpoint not backed by its own table; it reads `audit_log`
  instead (`lib/integration/changes.ts`), which is genuinely the only change-tracking mechanism
  this schema has. `audit_log.entity_type` is `task` for real operational events, plus `api_key`
  for the integration feature's own key lifecycle (see the `api_keys` bullet above) — this
  endpoint **always** scopes its underlying query to `entity_type = 'task'`, regardless of the
  `entity_type` query param. `api_key` rows are deliberately excluded: that entity isn't in the
  spec's Core Entities list, and a key create/revoke is an administrative event about this
  integration layer itself, not business data Databricks should ingest through it. Passing
  `entity_type` for a real Core Entity this schema doesn't audit (season, brand, ...) returns an
  empty page, not an error — an honest reflection that no tracking exists yet, not a bug.
  **`record` is the audit row's own stored diff payload** (`{ task_id, task_name, changes }`,
  where `changes` is exactly `audit_log.changes` — the `AuditFieldChange[]`/`AuditPartyChange[]`/
  `owners`/`backfilled` shape `types/audit.ts` defines), **not a full current-state snapshot of
  the task** — `audit_log` was never designed to store one (see its own schema section above),
  and joining today's `tasks` row onto a historical change event would misrepresent history for
  every event except the most recent one on that task. `operation` maps `action` →
  created/updated/deleted via a fixed table in `changes.ts` (`task.create`→created,
  `task.delete`→deleted, everything else — update, restore, participants_change —→updated); an
  action this table hasn't been taught about yet degrades to `updated` rather than throwing.
  `version` is `null` like every endpoint — `audit_log` has no change-counter column either.
  Cursor pagination reuses `lib/integration/cursor.ts`'s (updated_at, id) keyset verbatim even
  though this table's real ordering field is `created_at` and is append-only (no updates) — the
  cursor's field name is opaque internal shape, never read as anything but "resume after this."
  Each row also carries its own `cursor` field (its own resumable position), matching the
  spec's literal per-row shape — every other list endpoint only puts a cursor in `meta`.
- **`/tasks` and `/tasks/{task_id}` are live** — the big one, previously held back because "most
  fields have no backing column"; that caution no longer applies per
  [[integration-api-null-policy]] (client-confirmed: send `null`, don't hold back the endpoint).
  `lib/integration/tasks.ts` is the source of truth for the field-by-field accounting; the
  highlights:
  - **~15 spec fields are always `null`, no backing column at all**: `blocked_status`,
    `escalation_owner_name`, `is_milestone`, `milestone_flag`, `delay_reason_code`/
    `delay_reason_text`, `planned_*`/`actual_*` dates, `due_date_zapier`, `comments_count`
    (no comments table — `notes` is a single free-text field with no count concept),
    `attachments_count` (attachments are explicitly deferred, not a column gap to close later),
    `link_url`. The matching query-param filters (`blocked_status`, `escalation_owner_name`,
    `delay_reason_code`, `is_milestone`) are accepted per the spec but are no-ops.
  - **`assignee_name` is also always `null` despite `tasks.assignee_id` existing** — that column
    is superseded by `task_participants` and slated for removal (schema.md's own note: "don't
    write to it in new code"); reading it here would hand Databricks a column that quietly
    disagrees with `owner_name`, same reasoning the app's own CSV export
    (`tasks/export/task-record-columns.ts`) already gives for omitting it. This is the
    "column exists but means something different" caveat, distinct from a genuine missing column.
  - **`working_timeline_start_date`/`working_timeline_end_date` ARE real** —
    `tasks.start_date`/`end_date`. `duration_days` is computed live from them
    (`computeDurationDays`), and that's safe on an incremental feed specifically because both
    inputs are static stored columns, not "today" — the value only changes when one of them
    changes, which `updated_at` already captures.
  - **`days_late`/`days_at_risk` are ALWAYS `null` here — this is the one place the constraint
    flagged when `/reports/overdue-tasks` was built actually bites.** That report's
    `days_overdue` is safe to compute live only because it has no `updated_since` contract; `/tasks`
    genuinely does, so a live-computed day-count that silently drifts without `updated_at` moving
    would make an incremental consumer miss the change entirely. Don't "fix" this by copying
    `computeDaysOverdue` in here — that would reintroduce exactly the bug the earlier endpoint's
    own note warned against.
  - **`owner_name` is the usual joined string; `people_involved` is a real array**, not joined —
    matches the spec's own literal shape (`["Brand Managers", "Design"]`) and is what the app's
    own CSV export does NOT do (it joins both into strings) — a deliberate divergence from that
    convention for this one field, because the array is both truer to the spec and no harder to
    produce from the same underlying participant rows.
    `lib/integration/task-owners.ts`'s `resolveOwnerNames`/`resolvePeopleInvolvedNames` now share
    one batched-fetch helper (`fetchParticipantsByRole`) — refactored out when `people_involved`
    needed the same department-then-person/alphabetical ordering but as an array instead of a
    joined string, rather than duplicating the batching fix.
  - **`/tasks/{task_id}` returns the identical full row shape as `/tasks`**, not the narrower
    field set the spec's own single-item example sketches (missing `season_id`/`season_name`/
    `brand_id`/`gender`/`notes`/`calendar_*`/`comments_count`/`attachments_count`/`link_url`) —
    a deliberate unification, since maintaining two different shapes for one entity would drift,
    and the null-policy already demands every field present regardless. **No `deleted_at`
    filter** — a consumer fetching a specific id (e.g. one just seen in `/changes`) gets the row
    back with its real `deleted_at`, not a 404 that hides that it once existed; a genuinely
    unknown id still 404s.
  - **`calendar_sync_status` follows the same rule as `/calendar-events`**: `"synced"` only when
    `google_event_id` is set, never `"failed"`/`"pending"` for an unsynced task.
- **`integrations-info-card.tsx` is the one explanation of "where does the key go"** — base URL,
  the `apikey` header (not `Authorization`, not a query param), which endpoints are actually
  live, and what a `null` field means (genuinely unset vs. "this schema doesn't track that data,
  like every endpoint's `version`") — restated in plain language for whoever's wiring up
  Kong/Databricks, not just for someone reading this file. Same collapsible-card pattern as
  `settings/notifications`' own info card (open by default, `Collapsible` from
  `components/ui/collapsible`) — update both this card and the bullets above together if the
  mechanism changes; they're meant to say the same thing at two altitudes, not drift into two
  different explanations.
- **`/management/integrations/docs` is the in-app version of `docs/databricks-integration-api-spec.md`**
  — every one of the ~19 endpoints, transcribed the same way that file was, collapsed by default
  behind a Live/Planned badge (`endpoint-docs.ts`'s `ENDPOINT_DOCS` array is the single source
  for this page; keep it and the markdown spec in step when either changes — a `status: "live"`
  entry with a `note` field is how a deviation from the spec's literal shape gets called out,
  same idea as `/seasons`' `version: null`). Query-param descriptions are defined once
  (`PARAM_DESCRIPTIONS`) and referenced by name across endpoints, since most of the spec's ~30
  distinct params (`cursor`, `updated_since`, `include_deleted`, …) repeat across a dozen-plus
  endpoints — writing the same sentence per endpoint would drift out of sync with itself over
  time. Every one of these is `GET`-only — there is no "what to send in the body" for any
  endpoint here, the spec is read-only end to end (see "Integration Principles" at the top of
  the markdown spec) — the docs page's per-endpoint "Required headers" line is the closest
  analog, since a request's only real input is its headers and query string.
