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
2. `password-form.tsx` maps a banned-user error to the deactivated message, and re-checks status
   after a successful sign-in.
3. `auth/callback/route.ts` refuses the Google path for a non-active profile.
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
Calendar. Nothing reads events back. `lib/google/calendar.ts` deliberately has no list/read
function; if you find yourself adding one, that's the rule being broken, not a gap being filled.
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

**Push scope is owners resolved through `task_participant_profiles`, not `tasks.assignee_id`.**
Department-owned tasks are the overwhelming majority (832 of 833 rows), and `assignee_id` is null
for all of them, so scoping by that superseded column would push almost nothing.

**Calendar eligibility is a property of the account, not of token presence.**
`isGoogleCalendarEligible()` requires a non-`external` role, `calendar.sync_google`, and a
Workspace email. Checking "is there a `google_oauth_tokens` row" instead would be wrong in both
directions: a token outlives a role change, and an absent token is indistinguishable from an
expired one.

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

**Filtering by a participant costs an extra round trip.** PostgREST can't express
`id in (select task_id from …)` inline, so `listTasks` resolves the id set first — via
`task_participants` for the Owner filter, via the `task_participant_profiles` view for
"relevant to me". An empty result set filters on an impossible uuid (`EMPTY_RESULT_ID`) rather
than dropping the clause, which would silently widen the query to "no filter at all".

**"My tasks" is now transitive.** Upcoming scopes through `task_participant_profiles`, so being
in Planning shows you every task Planning owns, not just ones naming you. Upcoming deliberately
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
  *"of the work due in May, this much is done"* — not "completed during May".
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
- **Export is client-side CSV** from data already rendered — no second fetch, no Route Handler.
  It emits the **full** breakdowns, not the charts' trimmed top-N.
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
- The card's `loading.tsx` block hardcodes `h-[616px]` — 14 × the grid's 44px `ROW_HEIGHT`
  (12 rows + a 2-band header). Tailwind can't see a computed class, so it can't be derived from
  the constant; if either number changes, change this too.

---

## Timeline / Gantt (`/timeline`)

**Cost: 4 Supabase calls** — timeline tasks, overdue tasks, season options, brand options, all
issued together via `Promise.all`. View/period/filter changes re-run the Server Component
(`shallow: false`), so they re-query; scrolling and opening the drawer do not.

**This module has a second consumer.** The Dashboard's Gantt card renders `TimelineToolbar`,
`TimelineGrid`, `TimelineTaskBar`, `TimelineStatusLegend` and `TimelineOverduePanel` — the same
components, different state source (see the Dashboard section). None of them fetch; they take
tasks, a range and a view as props, which is what makes that possible. Keep it that way: a
`data/*` import inside any of them would break the preview. Only `TimelineWorkspace` and
`page.tsx` are `/timeline`-specific.

### Gotchas

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
  is exactly what shouldn't scroll out of sight. It does respect the season/brand filters.
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

**Columns are fixed-width, not content-sized.** Each one declares `meta.width` from the five-step
scale in `column-widths.ts` (defaulting to `md`), `DataTable` emits those as a `<colgroup>`, and
the table lays out `table-fixed` with `min-width` set to their sum. Below that width it scrolls;
above it, the columns share the slack proportionally rather than leaving a gutter. This is what
stops one long task name or description from dragging a column — and the whole page — sideways.
Adding a column without a `width` silently gets `md` (176px), which is usually wrong for a badge
or a count.

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
