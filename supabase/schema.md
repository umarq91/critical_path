# Database Schema

Read this before any schema/RLS decision — it should always match what's actually in
`supabase/migrations/`. Update it in the same PR as any migration. This is the real,
as-built schema, not the aspirational one in `plan.md` §4 (that's the original sketch;
this is what actually exists).

RLS pattern used everywhere: one `select` policy (usually `true` for any authenticated
user), one `for all` policy gating writes to `admin` via `is_admin()`. Kept deliberately
simple — no per-field/per-row RLS logic; that nuance lives in `lib/permissions.ts` +
Server Actions instead. See `0003_seasons.sql` for the reference shape.

**`0018_external_user_access.sql` is the exception to "usually `true`", and it matters.**
Once accounts can exist for people outside the company (`external`), a blanket
`using (true)` read policy hands them the whole organisation's task list and staff
directory. `tasks`, `task_participants`, `task_people` and `profiles` are therefore scoped:
internal roles still read everything, an `external` user reads only tasks they participate
in (and only the people on those tasks). Lookup tables (`seasons`, `brands`, `key_stages`,
`departments`) stay readable by any active user — an external user's own task rows have to
render their season/brand/department labels — and those *pages* are gated in the app layer
instead (`lookups.view` / `brand.view` + `requirePageAccess`).

`tasks` is the one exception: its write matrix genuinely isn't admin-only (`standard_user`
creates/edits tasks too, per `lib/permissions.ts`), so it has separate insert/update/delete
policies keyed off `current_user_role()` instead of the single `is_admin()`-gated `for all`
policy — see `0006_tasks.sql`.

---

## Enums

| Enum | Values | Used by |
|---|---|---|
| `user_role` | `admin`, `standard_user`, `viewer`, `external` | `profiles.role`. `external` (`0017`) = a platform user who is **not** in the client's Google Workspace: created by an admin, signs in with email + password, never through Google. Role and account type are one and the same thing — there is no separate `auth_provider` column, deliberately, so the two can't disagree |
| `season_status` | `planning`, `upcoming`, `active`, `completed` | `seasons.status` |
| `brand_status` | `active`, `inactive` | `brands.status` |
| `task_gender` | `men`, `women`, `unisex` | `tasks.gender` |
| `task_status` | `not_started`, `in_progress`, `completed`, `overdue` | `tasks.status` |
| `task_priority` | `high`, `med`, `low` | `tasks.priority` |
| `task_dpsp_category` | `demand`, `product`, `sales`, `profit` | `tasks.dpsp_category` |

## Helper functions

| Function | Purpose |
|---|---|
| `set_updated_at()` | Trigger fn — stamps `updated_at = now()` on every table that has the column. Attach via `create trigger ..._set_updated_at before update ... execute function public.set_updated_at();` |
| `current_user_role()` | Returns the caller's role. `security definer`, bypasses RLS on `profiles` internally so it can be called *from inside* other RLS policies without recursion. |
| `is_admin()` | `current_user_role() = 'admin'`. What every write policy checks. |
| `is_active_user()` | `0018`. True when the caller's profile exists and `status = 'active'`. Gates every task/participant/profile read and write policy — this is what makes deactivating a user a real revocation rather than a badge. |
| `is_external_user()` | `0018`. `current_user_role() = 'external'`. |
| `task_involves_current_user(task_id)` | `0018`. Is the caller a participant on this task — named directly, or via their department? The `task_participant_profiles` UNION expressed as a per-row predicate. Row-dependent, so it genuinely runs per row. |
| `profile_shares_task_with_current_user(profile_id)` | `0018`. Does this profile appear on any task the caller is also on? Gates which people an external user can resolve. |

**Policy performance idiom (`0018`):** parameterless predicates are called as `(select public.is_active_user())`, not bare. The scalar subquery is hoisted into an InitPlan and evaluated once per statement; a bare call is re-evaluated per row scanned. Predicates taking the row's own id (`task_involves_current_user(id)`) must stay unwrapped.

---

## Tables

### `profiles`
*Migration: `0001_profiles_roles.sql`. Mirrors `auth.users`; one row per user, created automatically on sign-up.*

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK | = `auth.users.id` |
| `email` | text | |
| `full_name` | text, nullable | from Google OAuth metadata |
| `avatar_url` | text, nullable | from Google OAuth metadata |
| `role` | `user_role`, default `viewer` | admin/service-role only — see below |
| `department_id` | uuid, nullable, FK → `departments.id` | `on delete set null`; admin/service-role only. Was a free-text `department` column until `0009_departments.sql` promoted it to a proper lookup FK |
| `google_group_id` | text, nullable | admin/service-role only |
| `status` | text, default `active` | `active` \| `inactive`; admin/service-role only |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | auto |

**RLS (rewritten in `0018`):** reading your own row is unconditional — a deactivated user must still be able to load their own profile, or `(app)/layout.tsx` can't distinguish "deactivated" from "signed out" and ping-pongs against `proxy.ts`. Beyond that: an active internal user reads every profile (needed for owner/assignee pickers); an active `external` user reads only profiles sharing a task with them (`profile_shares_task_with_current_user`); an inactive user reads nothing else. Update allowed for self or admin — but a trigger blocks anyone except admin/service-role from changing `role`, `status`, `department_id`, or `google_group_id`, even on their own row. No insert/delete policies — rows are only created by the `handle_new_user` trigger on sign-up, never hard-deleted (deactivate via `status` instead).

*Migration: `0004_profiles_guard_allow_dashboard.sql`.* The privileged-column guard also exempts direct dashboard/DB connections (`session_user in ('postgres', 'supabase_admin')`) — stopgap so the Supabase project owner can hand-edit `role`/`status`/`department_id`/`google_group_id` via the SQL Editor / Table Editor before an admin-bootstrap flow exists. Tighten this back up once that flow lands.

### `seasons`
*Migration: `0003_seasons.sql`. Top-level grouping tasks are organised under (e.g. "RES H2'26" / Winter 2026).*

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `season_code` | text, unique | stable short code, e.g. `RES H2'26` |
| `season_name` | text | display name, e.g. `Winter 2026` |
| `status` | `season_status`, default `planning` | |
| `start_date` | date | |
| `end_date` | date | must be ≥ `start_date` |
| `color` | text, default `#2b6ef6` | season colour-coding across the app |
| `owner_id` | uuid, nullable, FK → `profiles.id` | `on delete set null` |
| `created_at` / `updated_at` | timestamptz | |
| `deleted_at` | timestamptz, nullable | soft delete |

**RLS:** any authenticated user reads; only admin writes.

**Deliberately not columns:** task count, brand count, completion %, owner count — all shown on the Seasons admin page but computed from `tasks` once that table exists, not stored here.

### `brands`
*Migration: `0005_brands.sql`, `season_id` replaced by `brand_seasons` in `0013_brand_seasons.sql`. Stable brand identity referenced by `tasks.brand_id`.*

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `brand_code` | text, unique | stable short code, e.g. `BR-A` |
| `brand_name` | text | display name, e.g. `Brand A` |
| `description` | text, nullable | |
| `status` | `brand_status`, default `active` | |
| `color` | text, default `#2b6ef6` | brand colour-coding, same pattern as `seasons.color` |
| `created_at` / `updated_at` | timestamptz | |
| `deleted_at` | timestamptz, nullable | soft delete |

**RLS:** any authenticated user reads; only admin writes — kept permissive at the table level (same as `seasons`/`key_stages`/`departments`, see the note above `profiles`) so every role's own task rows can still resolve a `brand_id` to a name. The `/brands` admin **page** itself is stricter: `brand.view` in `lib/permissions.ts` is admin-only, so `standard_user`/`viewer`/`external` never see the page or its nav link even though the underlying rows stay joinable. `brand.manage`/`brand.delete` stay admin-only at both layers (Brands has its own granular row on the client's Role-Based Access screen, unlike most other lookups which still fall under `admin.manage_lookups`).

**Deliberately not a column:** brand's task count — shown on the admin Brands page but computed from `tasks` once that table exists, same reasoning as `seasons`.

### `brand_seasons`
*Migration: `0013_brand_seasons.sql`. "Seasons" on the Brands admin page — many-to-many between `brands` and `seasons`, same join-table shape as `task_people`. Replaces the original `brands.season_id` (not-null FK, one season per brand) once that stopped matching the confirmed requirement.*

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `brand_id` | uuid, FK → `brands.id`, not null, `on delete cascade` | |
| `season_id` | uuid, FK → `seasons.id`, not null, `on delete restrict` | restrict, not cascade/set null — seasons are soft-deleted, not hard-deleted, matching `brands.season_id`'s original reasoning |
| `created_at` | timestamptz | |

`unique (brand_id, season_id)` — no duplicate associations. `createBrand`/`updateBrand` (`brands/_actions.ts`) write the full set here in the same request as the `brands` row itself; an edit replaces the whole set rather than diffing add/remove.

**RLS:** same matrix as `brands` and `task_people` — any authenticated user reads; only admin writes (`brand.manage`/`brand.delete`).

### `key_stages`
*Migration: `0008_key_stages.sql`. Lightweight lookup entity tasks can optionally be grouped under (e.g. for Timeline/Gantt row grouping). Deliberately minimal: no status/color/season link like brands/seasons.*

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `name` | text | |
| `description` | text, nullable | |
| `created_at` / `updated_at` | timestamptz | |
| `deleted_at` | timestamptz, nullable | soft delete |

**RLS:** any authenticated user reads; only admin writes — falls under the general `admin.manage_lookups` bucket in `lib/permissions.ts`, same as `seasons` (no dedicated `key_stage.*` row on the client's Role-Based Access screen).

### `external_links`
*Migration: `0021_external_links.sql`. Flat, admin-curated list of resources the team reaches from the platform (shared drives, reference sites, supplier portals). Title + description + url and nothing else — no category, no `sort_order`, no owner. This is the table `plan.md` §4 sketched as `sales_toolkit_links`; if the Sales Toolkit page is ever built it should read this rather than add a second one.*

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `title` | text | |
| `description` | text, nullable | |
| `url` | text | absolute, normalised to `https://` on write by `external-links/schema.ts` — never stored scheme-less |
| `created_at` / `updated_at` | timestamptz | |
| `deleted_at` | timestamptz, nullable | soft delete |

**RLS:** active **internal** users read (`is_active_user() and not is_external_user()`); only admin writes. Note this is *stricter* than `key_stages`/`departments`, which any active user reads: those carry labels an external user's own task rows have to render, whereas this table is an internal resource list that appears on no other screen. The read rule mirrors `lookups.view` in `lib/permissions.ts` — change one, change both.

### `departments`
*Migration: `0009_departments.sql`. Lightweight lookup entity, same shape as `key_stages` — users can optionally belong to one.*

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `name` | text | |
| `description` | text, nullable | |
| `is_external` | boolean, not null, default `false` | `0015` — Vendor/Supplier and similar: no logins, ever |
| `contact_email` | text, nullable | `0015` — where a reminder goes when the party has no member profiles |
| `created_at` / `updated_at` | timestamptz | |
| `deleted_at` | timestamptz, nullable | soft delete |

**RLS:** any authenticated user reads; only admin writes — falls under the general `admin.manage_lookups` bucket in `lib/permissions.ts`, same as `key_stages` (no dedicated `department.*` row on the client's Role-Based Access screen).

Membership is managed at `/management/teams` (add/remove writes `profiles.department_id`); because that's a single FK, **a person belongs to exactly one department** and adding them to a second one moves them. Referenced by `profiles.department_id` (nullable FK, `on delete set null` — deleting a department clears it from every user who had it) and, since `0015_task_participants.sql`, by `task_participants.department_id`: a department is an **assignable party** on a task, not just a label on a user. Still deliberately **not** a column on `tasks` itself.

Seeded from real client data — see `supabase/seed-departments.sql` and the Departments section of `things-to-know.md`.

### `tasks`
*Migration: `0006_tasks.sql`, `priority` added in `0014_tasks_priority.sql`, `due_date` made nullable in `0022_tasks_due_date_optional.sql`. The core entity — spreadsheet grid, calendar, Gantt/Timeline, and dashboards all read from this table.*

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `task_name` | text | |
| `season_id` | uuid, FK → `seasons.id`, not null | |
| `brand_id` | uuid, FK → `brands.id`, **nullable** since `0016_tasks_brand_optional.sql` | Optional, unlike `season_id` — plenty of stage work (trend trips, range reviews, shipping) isn't brand-specific, and the client's export has no BRAND column at all. FK left as restrict, not `set null`: brands are soft-deleted, so a brand vanishing under a task should surface, not silently blank the column |
| `key_stage_id` | uuid, FK → `key_stages.id`, nullable, `on delete set null` | optional — a task isn't required to belong to a key stage |
| `gender` | `task_gender`, not null | `men` \| `women` \| `unisex` |
| `due_date` | date, nullable since `0022_tasks_due_date_optional.sql` | Some of the client's historical data has no known due date. A task with `due_date is null` still appears on the Tasks grid, is never counted as overdue, and is excluded from the Calendar, Gantt/Timeline, and the Dashboard's due-date-bucketed Completion Trend (it still counts in the all-time status/season/brand/gender tiles) |
| `assignee_id` | uuid, FK → `profiles.id`, nullable, `on delete set null` | **Superseded by `task_participants` (`0015`)** — owner is 1..n parties, each a profile *or* a department, not one profile. Backfilled and left in place during the expand phase; a follow-up migration drops it. Don't write to it in new code |
| `status` | `task_status`, default `not_started` | `not_started` \| `in_progress` \| `completed` \| `overdue` |
| `priority` | `task_priority`, default `med` | `high` \| `med` \| `low` — was stubbed as a hardcoded "Not set" placeholder in the task detail drawer until this migration landed |
| `notes` | text, nullable | the UI's "Comments" column — a single free-text field on the task, not a separate `task_comments` table |
| `start_date` | date, nullable | working-timeline start, for the future Gantt/Timeline view |
| `end_date` | date, nullable | expected finish date; `check (end_date >= start_date)` |
| `created_by` | uuid, FK → `profiles.id`, nullable, `on delete set null` | stamped by `createTask`, never client input |
| `last_edited_by` | uuid, FK → `profiles.id`, nullable, `on delete set null` | stamped by `createTask`/`updateTask` on every write |
| `deleted_by` | uuid, FK → `profiles.id`, nullable, `on delete set null` | stamped by `deleteTask` alongside `deleted_at` |
| `is_locked` | boolean, default `false` | column only — no enforcement yet, see below |
| `locked_by` / `locked_at` | uuid FK → `profiles.id` / timestamptz, nullable | columns only — no enforcement yet, see below |
| `google_event_id` | text, nullable | Google Calendar event id this task is pushed to — set by `syncGoogleCalendar()`, see below |
| `google_calendar_owner_id` | uuid, FK → `profiles.id`, nullable, `on delete set null` | whose Google Calendar `google_event_id` actually lives on. A task maps to exactly one event, so the first eligible **owner** to sync claims it and other owners skip it — needed so `updateTask`/`deleteTask` touch the event on the right account |
| `google_synced_at` | timestamptz, nullable | last time this task was **pushed** to Google Calendar. Since `0019` there is no pull, so this is a record of the last outbound write and never an input to a conflict check |
| `created_at` / `updated_at` | timestamptz | |
| `deleted_at` | timestamptz, nullable | soft delete |
| `dpsp_category` | `task_dpsp_category`, nullable, added `0023_tasks_dpsp_category.sql` | Optional — groups a task into the DPSP Flywheel board (`/dpsp-flywheel`) under Demand, Product, Sales or Profit. Most tasks have no category and simply don't appear on that board; it's an additional lens over the same task, not a replacement for `key_stage_id` |

**Deliberately not columns (this pass):** attachments (explicitly deferred).

**Google Calendar sync — ONE-WAY, manual, per-user, owner-scoped.** `lib/google/calendar.ts` + `lib/google/task-calendar-sync.ts` push tasks out; nothing reads events back in. `calendar/_actions.ts`'s `syncGoogleCalendar()` (the Calendar page's Sync button, not a cron) pushes the tasks the signed-in user **owns** — resolved through `task_participant_profiles` where `role = 'owner'`, so a task owned by their *department* counts, not just one naming them personally — to their primary Google Calendar as all-day events, within roughly the surrounding year. `updateTask` re-pushes an already-linked event when `task_name`/`due_date` changes, on whichever account holds it; `deleteTask` best-effort deletes it. All three are best-effort: a Google failure never fails the platform write.

Eligibility is a property of the account, not of token presence — `isGoogleCalendarEligible()` (`lib/calendar-eligibility.ts`) requires a non-`external` role, `calendar.sync_google`, and a Workspace email address. External users therefore never sync and never see the Sync button.

**Google Calendar is never a source of truth.** `0011`'s pull-back (a Google event whose `updated` beat `google_synced_at` overwrote the task's title/date) and its `external_calendar_events` cache of unrelated events were both removed in `0019`. The platform calendar shows platform tasks only.

**Auth for the Calendar API call itself is per-user OAuth (`google_oauth_tokens` below), NOT the domain-wide-delegated service account** used for role sync — see that table's note for why, and why this is meant to be temporary.

**Locking — columns exist, behavior doesn't yet.** `is_locked`/`locked_by`/`locked_at` were added in `0007_tasks_tracking_and_timeline.sql` alongside the other tracking columns, but nothing sets or enforces them yet (no toggle action, no RLS restriction, no disabled-field UI). `lib/permissions.ts` already has `task.lock`/`task.edit_due_date_when_locked` actions reserved for when that follow-up lands.

**RLS — the one table that isn't the simple admin-only-write pattern**, rewritten in `0018`: an **active** internal user reads every task (`task.view` is granted to every internal role); an active `external` user reads only tasks `task_involves_current_user(id)` matches; an inactive user reads none. Insert/update require an active account plus `standard_user` or `admin`, matching `task.create`/`task.update` in `lib/permissions.ts` — `external` is simply absent from that allow-list, so it has no write path at all. Delete stays admin-only (`task.delete` isn't in `STANDARD_USER_ALLOWED`).

### `task_participants`
*Migration: `0015_task_participants.sql`. Owner **and** People Involved, in one table. Supersedes both `tasks.assignee_id` and `task_people` — a participant is either a profile or a department, a task can have any number of each, in either role.*

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `task_id` | uuid, FK → `tasks.id`, not null, `on delete cascade` | |
| `profile_id` | uuid, FK → `profiles.id`, nullable, `on delete cascade` | exactly one of this / `department_id` is set |
| `department_id` | uuid, FK → `departments.id`, nullable, `on delete cascade` | |
| `role` | `task_participant_role`, not null | `owner` \| `involved` |
| `created_at` | timestamptz | |

`check (num_nonnulls(profile_id, department_id) = 1)` — a polymorphic party kept as two real FKs rather than a `(party_type, party_id)` pair, so cascades and referential integrity still apply.

Uniqueness is **two partial indexes** (`…_profile_uniq`, `…_department_uniq`), not one composite unique constraint: Postgres treats NULLs as distinct, so `unique (task_id, profile_id, department_id, role)` would let duplicates through on whichever column is null.

**Owner is not capped at one.** The client's export has two owners on 283 of 833 tasks (34%) — `Product Development, Vendor`, `US Team, EU Team` — and that's intentional joint ownership. If that ever needs enforcing, it's a partial unique index on `(task_id) where role = 'owner'`, not a schema change.

**A department participant may have zero member profiles** and that's a normal state, not a data error — `Vendor` (254 owner rows) and `Supplier` (16) are external and will never have logins. Anything resolving a task to human recipients has to handle the empty case and fall back to `departments.contact_email`.

**RLS:** same matrix as `tasks`, and scoped the same way since `0018` — an external user only sees participants of tasks they're on, so they can't enumerate who works on work that's invisible to them. Add/remove requires an active account plus `standard_user` or `admin`, matching `task.assign` in `lib/permissions.ts`.

### `task_participant_profiles` (view)
*Migration: `0015_task_participants.sql`. Flattens department membership down to individual profiles: `(task_id, role, profile_id, via)` where `via` is `direct` or `department`.*

Exists so "tasks relevant to me" stays one query rather than the three hops (me → my department → tasks that department participates in) PostgREST can't express inline — which is already why `listTasks` does a two-step for `task_people` today. Built with `union`, not `union all`: being named directly *and* sitting in the owning department is the common case (95% of rows in the client export) and should collapse to one row. `security_invoker = on`, so the underlying tables' RLS still applies through it.

### `task_people`
*Migration: `0010_task_people.sql`. **Superseded by `task_participants`** (`0015`) — backfilled from and left in place during the expand phase; a follow-up migration drops it once the app reads from `task_participants`. Don't write to it in new code.*

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `task_id` | uuid, FK → `tasks.id`, not null, `on delete cascade` | |
| `profile_id` | uuid, FK → `profiles.id`, not null, `on delete cascade` | |
| `created_at` | timestamptz | |

`unique (task_id, profile_id)` — no duplicate associations.

**RLS:** same matrix as `tasks` itself, and scoped in `0018` alongside `task_participants` — leaving this superseded table on `using (true)` would have been a read-around for the whole people-involved graph.

### `audit_log`
*Migration: `0020_audit_log.sql`. Append-only record of key user actions — the table behind Management → Logs (`/management/logs`).*

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `actor_id` | uuid, FK → `profiles.id`, nullable, `on delete set null` | who did it. Never cascade — deleting a person must not erase what they did |
| `actor_email` | text, nullable | snapshot taken at write time; what keeps the row attributable once the profile is gone |
| `action` | text, not null | `task.create` \| `task.update` \| `task.delete` \| `task.participants_change` today. One participant verb, not one per role — the detail drawer confirms owners and people involved in a single save, and that must read as one entry. **Text, not an enum** — the vocabulary grows with the app (`src/constants/audit.ts` is the app-side list), and an enum would mean a migration per new verb |
| `entity_type` | text, not null | `task` today |
| `entity_id` | uuid, nullable | **no FK** — the row it points at is routinely soft-deleted, and a hard delete must not take its history with it |
| `entity_label` | text, nullable | the entity's name *at the time*, so a renamed or deleted task still reads correctly |
| `changes` | jsonb, default `{}` | shape depends on `action` — see `src/types/audit.ts`. Field-level diffs for updates, added/removed party names for participant changes, `{ backfilled: true }` for rows this migration generated |
| `created_at` | timestamptz | |

**Append-only by policy.** There is a select policy and an insert policy, and deliberately **no update or delete policy** — nothing holding `authenticated` can rewrite history; only the service-role client or a DB admin can. That's what makes the log worth reading.

**RLS:** select is **admin-only** (`is_admin()`), mirroring `admin.view_audit_log` in `lib/permissions.ts` — the table holds every task title and every actor's email organisation-wide, so the usual `using (true)` read policy would hand an external user the lot. Insert is `is_active_user() and actor_id = auth.uid()`: a `standard_user` writes their own `task.create` entry through their own client, and no row can be attributed to someone else.

**Why this exists when `tasks` already has `created_by`/`last_edited_by`/`deleted_by`:** those hold the *latest* actor only. "Who moved the due date on 12 Aug, and what was it before" isn't answerable from them, and an owner change leaves no trace on `tasks` at all (it writes `task_participants`). Those columns stay as they are; this is the history.

**Values in `changes` are resolved to display labels at write time** — a season FK is stored as `Winter 2026`, not a uuid. Reading the log never needs a second round trip, and a label captured then still tells the truth after the thing it named is renamed or deleted.

**Backfilled on install** from `tasks`' own tracking columns, so the page opens with the history that already existed. Those rows carry `{ backfilled: true }` and no field detail (`tasks` records *that* a row was edited, not what changed) — the UI says so rather than rendering an empty diff. Each backfill block is guarded by a not-exists on `(entity_id, action)`, so re-running the file adds nothing.

### `reminder_rules`, `reminder_rule_tasks`, `notifications_log`
*Migration: `0024_reminder_rules.sql`. Personal email reminders — the settings cards on `/upcoming`, not an admin-managed rule set. See things-to-know.md's Reminders section for the full picture (timezone assumption, offset semantics, the cron/pg_cron wiring).*

**`reminder_rules`** — at most one row per profile (`profile_id unique`):

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `profile_id` | uuid, FK → `profiles.id`, unique, not null, `on delete cascade` | |
| `offset_days` | integer[], not null, default `{}` | each entry is "notify N days before `due_date`" — presets (2/1/7) and a custom value are just integers in the same array |
| `notify_hour` | smallint, not null, default `9` | hour of day (0–23) to send, in a single fixed org timezone — see things-to-know.md |
| `is_enabled` | boolean, not null, default `true` | master on/off without deleting the configuration |
| `created_at` / `updated_at` | timestamptz | |

**`reminder_rule_tasks`** — which of the profile's own tasks the rule applies to, a plain join (`rule_id`, `task_id`, unique pair) — not a scope-type table. Season/owner are filters *inside* the task picker UI, never a second matching mechanism.

**`notifications_log`** — dedupe + audit for the cron route: `rule_id`, `task_id`, `offset_days`, `sent_at`, unique on the triple. A row here means that exact reminder already went out; the cron route checks this before sending, not before matching.

**RLS:** `reminder_rules`/`reminder_rule_tasks` are owner-only (`profile_id = auth.uid()`, or a join back to the owning rule) — a personal preference, not a lookup entity, so there's no "everyone reads, admin writes" split. `notifications_log` has **no policies at all** — only the service-role client (`lib/supabase/admin.ts`, used exclusively by `/api/cron/task-reminders`) can touch it.

### `google_oauth_tokens`
*Migration: `0012_google_oauth_tokens.sql`. Per-user Google OAuth access/refresh tokens, used only to call the Calendar API as that specific user.*

**⚠️ TEMPORARY — read before touching Google Calendar sync.** Domain-wide delegation (the `GOOGLE_SERVICE_ACCOUNT_*` service account already used for role sync above) can only impersonate accounts inside a real Google Workspace domain — there's no admin console for a personal `@gmail.com` address to grant it from. While dev/test sign-ins use personal Gmail accounts (`NEXT_PUBLIC_GOOGLE_WORKSPACE_DOMAIN=gmail.com`), Calendar sync instead uses standard per-user OAuth consent: `google-button.tsx` requests the `calendar.events` scope at sign-in, `auth/callback/route.ts` stores the resulting token here, and `lib/google/calendar.ts` reads/refreshes it. **Once real Workspace accounts are in use, revisit switching Calendar sync to domain-wide delegation instead** (consistent with role sync, and avoids every user re-consenting to a Calendar permission at every sign-in) — at that point this table, `lib/google/oauth-tokens.ts`, the `scopes`/`access_type`/`prompt` additions in `google-button.tsx`, and the `GOOGLE_OAUTH_CLIENT_ID`/`GOOGLE_OAUTH_CLIENT_SECRET` env vars can all be retired.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `profile_id` | uuid, FK → `profiles.id`, not null, unique, `on delete cascade` | one token set per user |
| `access_token` | text, not null | |
| `refresh_token` | text, nullable | Google only returns one on first consent (or a forced re-consent); preserved across routine access-token refreshes, see `saveGoogleTokens()` |
| `expires_at` | timestamptz, not null | when `access_token` expires — `lib/google/calendar.ts` lets `googleapis` auto-refresh once this passes |
| `scope` | text, nullable | the scope string granted, for reference |
| `created_at` / `updated_at` | timestamptz | |

**RLS: zero policies.** RLS is enabled but nothing grants access — not even a `profile_id = auth.uid()` self-read, since these are live API credentials, not display data. The only access path is `lib/google/oauth-tokens.ts`, which always goes through the service-role client (`lib/supabase/admin.ts`) and scopes every query to a specific `profile_id` in application code.

### `api_keys`
*Migration: `0025_api_keys.sql`. Backs `/management/integrations` and auth for the read-only integration API (`/integration/v1/*`) — see things-to-know.md's Integrations section and `docs/databricks-integration-api-spec.md`.*

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `name` | text, not null | admin-chosen label, e.g. "Databricks — Production" |
| `key_prefix` | text, not null | first 12 chars of the raw key (`cpi_` + entropy), shown in the UI so a key is recognisable without the secret ever being stored |
| `key_hash` | text, not null, unique | SHA-256 hex digest of the raw key — the raw value itself is never persisted anywhere |
| `status` | text, not null, default `active` | `active` \| `revoked` — no delete policy; a key is revoked, never removed, same idiom as deactivating a user |
| `created_by` / `revoked_by` | uuid, FK → `profiles.id`, nullable, `on delete set null` | |
| `created_at` / `revoked_at` / `last_used_at` | timestamptz | `last_used_at` is bumped best-effort by `requireIntegrationApiKey()` on every authenticated request |

**RLS:** admin-only in every direction (`is_admin()`, same shape as `audit_log`'s select policy) — a leaked key is a standing read into whatever the integration API exposes, at least as sensitive as the audit log itself. No delete policy.

---

## Migration log

| File | What it does |
|---|---|
| `0001_profiles_roles.sql` | `user_role` enum (originally `admin`/`manager`/`viewer`), `profiles` table, `is_admin()`/`current_user_role()`, sign-up trigger, RLS. |
| `0002_rename_role_manager_to_standard_user.sql` | Renames the `manager` enum value to `standard_user` in place (0001 was already applied when this was needed, so it's a follow-up rename, not an edit to 0001). |
| `0003_seasons.sql` | `season_status` enum, `seasons` table, RLS. |
| `0004_profiles_guard_allow_dashboard.sql` | Exempts direct Supabase Dashboard/SQL Editor connections (`postgres`/`supabase_admin` session roles) from the privileged-column guard on `profiles` — stopgap until a real admin-bootstrap flow exists. |
| `0005_brands.sql` | `brand_status` enum, `brands` table (incl. required `season_id` FK → `seasons.id`), RLS. |
| `0006_tasks.sql` | `task_gender`/`task_status` enums, `tasks` table (FKs to `seasons`, `brands`, `profiles`), RLS with a non-admin-only write matrix. Also carries an idempotent guard that re-runs `0002`'s `manager` → `standard_user` enum rename if that migration was never applied on this database. |
| `0007_tasks_tracking_and_timeline.sql` | Adds `created_by`/`last_edited_by`/`deleted_by` (who-did-what tracking), `is_locked`/`locked_by`/`locked_at` (columns only, no enforcement yet), and `start_date`/`end_date` (working timeline) to `tasks`. |
| `0008_key_stages.sql` | `key_stages` table (name + description only), RLS, and `tasks.key_stage_id` (nullable FK, `on delete set null`). |
| `0009_departments.sql` | `departments` table (name + description only, same shape as `key_stages`), RLS, and replaces the old free-text `profiles.department` with `profiles.department_id` (nullable FK, `on delete set null`) — re-points the privileged-column guard trigger at the new column name. Not referenced by `tasks`. |
| `0010_task_people.sql` | `task_people` join table (`task_id`, `profile_id`, unique pair, both `on delete cascade`) — "People Involved," a many-to-many distinct from `tasks.assignee_id`. RLS matches `tasks`' own read-all/`standard_user`-or-`admin`-write pattern. |
| `0011_google_calendar_sync.sql` | Adds `google_event_id`/`google_calendar_owner_id`/`google_synced_at` to `tasks` for two-way sync, and creates `external_calendar_events` (self-scoped RLS) to cache the rest of a user's Google Calendar read-only. **Both halves of the sync were reversed by `0019`** — the columns survive, the table and the pull do not. |
| `0012_google_oauth_tokens.sql` | Creates `google_oauth_tokens` (zero RLS policies — service-role-only access) to hold per-user Calendar OAuth tokens. **Temporary** — see that table's note above. |
| `0013_brand_seasons.sql` | Drops `brands.season_id`, creates `brand_seasons` join table (same shape as `task_people`) so a brand can belong to multiple seasons. Migrates existing 1:1 links into the new table before dropping the column. |
| `0014_tasks_priority.sql` | Adds `task_priority` enum (`high`/`med`/`low`) and `tasks.priority` (default `med`), plus an index. |
| `0015_task_participants.sql` | `task_participant_role` enum (`owner`/`involved`), `task_participants` table (polymorphic profile-or-department party, two partial unique indexes, RLS matching `tasks`), `departments.is_external`/`contact_email`, the `task_participant_profiles` view, and a backfill from `tasks.assignee_id` + `task_people`. **Expand phase** — neither of those is dropped here; a follow-up does that once the app reads from `task_participants`. |
| `0016_tasks_brand_optional.sql` | Drops the NOT NULL on `tasks.brand_id`. Column and FK otherwise unchanged — brand is now optional on a task, season is not. |
| `0017_external_user_role.sql` | Adds `external` to the `user_role` enum, and **nothing else**. Postgres won't let a newly added enum label be *used* in the transaction that adds it, and Supabase runs each file in one transaction — so `0018` has to be a separate file. Do not merge them. |
| `0018_external_user_access.sql` | `is_active_user()`, `is_external_user()`, `task_involves_current_user()`, `profile_shares_task_with_current_user()`; rewrites the SELECT policies on `tasks`, `task_participants`, `task_people` and `profiles` to scope external users to their own tasks; adds an active-account requirement to those tables' read *and* write policies; updates `handle_new_user()` to honour a `user_metadata.app_role` hint of `external` (only that value — it can lower privilege, never raise it) so an admin-created external user's profile is born with the right role. |
| `0019_one_way_calendar_sync.sql` | Drops `external_calendar_events` and its RLS; re-comments `tasks.google_synced_at`/`google_calendar_owner_id` for one-way push semantics. Google Calendar can no longer write to a task. |
| `0020_audit_log.sql` | `audit_log` table (actor / action / entity / jsonb `changes`), four indexes, admin-only select + own-row insert and **no update or delete policy** (append-only), plus a rerun-safe backfill of create/update/delete events from `tasks`' tracking columns. Backs Management → Logs. |
| `0021_external_links.sql` | `external_links` table (title + description + url), internal-read/admin-write RLS, and a partial index on `title` for the default alphabetical ordering. Backs the External Links page. |
| `0025_api_keys.sql` | `api_keys` table (hashed key + prefix, admin-only RLS, revoke-not-delete) for the integration API's Kong-style Key Auth. Backs `/management/integrations` and `requireIntegrationApiKey()`. |

## Not built yet

Templates, holidays, leave, reminder rules, notifications log — see `plan.md` §4 for the original full sketch. Add each here as its migration lands. (`sales_toolkit_links` landed as `external_links` in `0021` under the client's own name for it.)
