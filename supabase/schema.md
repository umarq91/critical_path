# Database Schema

Read this before any schema/RLS decision — it should always match what's actually in
`supabase/migrations/`. Update it in the same PR as any migration. This is the real,
as-built schema, not the aspirational one in `plan.md` §4 (that's the original sketch;
this is what actually exists).

RLS pattern used everywhere: one `select` policy (usually `true` for any authenticated
user), one `for all` policy gating writes to `admin` via `is_admin()`. Kept deliberately
simple — no per-field/per-row RLS logic; that nuance lives in `lib/permissions.ts` +
Server Actions instead. See `0003_seasons.sql` for the reference shape.

`tasks` is the one exception: its write matrix genuinely isn't admin-only (`standard_user`
creates/edits tasks too, per `lib/permissions.ts`), so it has separate insert/update/delete
policies keyed off `current_user_role()` instead of the single `is_admin()`-gated `for all`
policy — see `0006_tasks.sql`.

---

## Enums

| Enum | Values | Used by |
|---|---|---|
| `user_role` | `admin`, `standard_user`, `viewer` | `profiles.role` |
| `season_status` | `planning`, `upcoming`, `active`, `completed` | `seasons.status` |
| `brand_status` | `active`, `inactive` | `brands.status` |
| `task_gender` | `men`, `women`, `unisex` | `tasks.gender` |
| `task_status` | `not_started`, `in_progress`, `completed`, `overdue` | `tasks.status` |

## Helper functions

| Function | Purpose |
|---|---|
| `set_updated_at()` | Trigger fn — stamps `updated_at = now()` on every table that has the column. Attach via `create trigger ..._set_updated_at before update ... execute function public.set_updated_at();` |
| `current_user_role()` | Returns the caller's role. `security definer`, bypasses RLS on `profiles` internally so it can be called *from inside* other RLS policies without recursion. |
| `is_admin()` | `current_user_role() = 'admin'`. What every write policy checks. |

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
| `department` | text, nullable | admin/service-role only |
| `google_group_id` | text, nullable | admin/service-role only |
| `status` | text, default `active` | `active` \| `inactive`; admin/service-role only |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | auto |

**RLS:** any authenticated user can read every profile (needed for owner/assignee pickers). Update allowed for self or admin — but a trigger blocks anyone except admin/service-role from changing `role`, `status`, `department`, or `google_group_id`, even on their own row. No insert/delete policies — rows are only created by the `handle_new_user` trigger on sign-up, never hard-deleted (deactivate via `status` instead).

*Migration: `0004_profiles_guard_allow_dashboard.sql`.* The privileged-column guard also exempts direct dashboard/DB connections (`session_user in ('postgres', 'supabase_admin')`) — stopgap so the Supabase project owner can hand-edit `role`/`status`/`department`/`google_group_id` via the SQL Editor / Table Editor before an admin-bootstrap flow exists. Tighten this back up once that flow lands.

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
*Migration: `0005_brands.sql`. Stable brand identity referenced by `tasks.brand_id`.*

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `brand_code` | text, unique | stable short code, e.g. `BR-A` |
| `brand_name` | text | display name, e.g. `Brand A` |
| `description` | text, nullable | |
| `status` | `brand_status`, default `active` | |
| `color` | text, default `#2b6ef6` | brand colour-coding, same pattern as `seasons.color` |
| `season_id` | uuid, FK → `seasons.id`, not null | every brand belongs to exactly one season (confirmed requirement) |
| `created_at` / `updated_at` | timestamptz | |
| `deleted_at` | timestamptz, nullable | soft delete |

**RLS:** any authenticated user reads; only admin writes — matches `brand.view` being granted to every role in `lib/permissions.ts`, while `brand.manage`/`brand.delete` stay admin-only (Brands has its own granular row on the client's Role-Based Access screen, unlike most other lookups which still fall under `admin.manage_lookups`).

**Deliberately not a column:** brand's task count — shown on the admin Brands page but computed from `tasks` once that table exists, same reasoning as `seasons`.

### `tasks`
*Migration: `0006_tasks.sql`. The core entity — spreadsheet grid, calendar, Gantt/Timeline, and dashboards all read from this table.*

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `task_name` | text | |
| `season_id` | uuid, FK → `seasons.id`, not null | |
| `brand_id` | uuid, FK → `brands.id`, not null | |
| `gender` | `task_gender`, not null | `men` \| `women` \| `unisex` |
| `due_date` | date, not null | |
| `assignee_id` | uuid, FK → `profiles.id`, nullable, `on delete set null` | "Owner / Assignee" — one combined field, not the two separate `owner`/`assignee` columns `plan.md`'s original sketch had; collapsed to match the confirmed UI (one column) and current scope |
| `status` | `task_status`, default `not_started` | `not_started` \| `in_progress` \| `completed` \| `overdue` |
| `notes` | text, nullable | the UI's "Comments" column — a single free-text field on the task, not a separate `task_comments` table |
| `start_date` | date, nullable | working-timeline start, for the future Gantt/Timeline view |
| `end_date` | date, nullable | expected finish date; `check (end_date >= start_date)` |
| `created_by` | uuid, FK → `profiles.id`, nullable, `on delete set null` | stamped by `createTask`, never client input |
| `last_edited_by` | uuid, FK → `profiles.id`, nullable, `on delete set null` | stamped by `createTask`/`updateTask` on every write |
| `deleted_by` | uuid, FK → `profiles.id`, nullable, `on delete set null` | stamped by `deleteTask` alongside `deleted_at` |
| `is_locked` | boolean, default `false` | column only — no enforcement yet, see below |
| `locked_by` / `locked_at` | uuid FK → `profiles.id` / timestamptz, nullable | columns only — no enforcement yet, see below |
| `created_at` / `updated_at` | timestamptz | |
| `deleted_at` | timestamptz, nullable | soft delete |

**Deliberately not columns (this pass):** `key_stage_id` (Key Stages skipped for now — see "Not built yet" below), attachments (explicitly deferred).

**Locking — columns exist, behavior doesn't yet.** `is_locked`/`locked_by`/`locked_at` were added in `0007_tasks_tracking_and_timeline.sql` alongside the other tracking columns, but nothing sets or enforces them yet (no toggle action, no RLS restriction, no disabled-field UI). `lib/permissions.ts` already has `task.lock`/`task.edit_due_date_when_locked` actions reserved for when that follow-up lands.

**RLS — the one table that isn't the simple admin-only-write pattern:** any authenticated user reads (`task.view` is granted to every role). Insert/update require `standard_user` or `admin` (`current_user_role() in ('standard_user', 'admin')`), matching `task.create`/`task.update` in `lib/permissions.ts`. Delete stays admin-only (`task.delete` isn't in `STANDARD_USER_ALLOWED`).

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

## Not built yet

Templates, holidays, leave, reminder rules, notifications log, sales toolkit links, audit log — see `plan.md` §4 for the original full sketch. Add each here as its migration lands.

**Key stages — skipped for now, build only if necessary.** `tasks.key_stage_id` can ship nullable and Timeline/Gantt grouping can fall back to "no stage" until this is actually needed; revisit once real task data shows whether the client is using Stage in practice.
