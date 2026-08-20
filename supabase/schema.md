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
| `search_profiles(search, exclude_ids, limit_count, offset_count)` | Word-by-word + `pg_trgm` fuzzy-matched, relevance-ranked profile search, added by `0011_profiles_smart_search.sql`. **No longer called from app code** — its correlated-subquery matching couldn't use the trigram indexes and was taking minutes on real data; `data/profiles.ts`'s `searchProfiles()` went back to a plain `.ilike()` query, which already covers the actual requirement (exact match, and a fragment like "um" finding "Umar"). Left deployed rather than dropped — harmless if unused, revisit only if fuzzier matching becomes a real requirement again. |

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

**RLS:** any authenticated user can read every profile (needed for owner/assignee pickers). Update allowed for self or admin — but a trigger blocks anyone except admin/service-role from changing `role`, `status`, `department_id`, or `google_group_id`, even on their own row. No insert/delete policies — rows are only created by the `handle_new_user` trigger on sign-up, never hard-deleted (deactivate via `status` instead).

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

### `departments`
*Migration: `0009_departments.sql`. Lightweight lookup entity, same shape as `key_stages` — users can optionally belong to one.*

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `name` | text | |
| `description` | text, nullable | |
| `created_at` / `updated_at` | timestamptz | |
| `deleted_at` | timestamptz, nullable | soft delete |

**RLS:** any authenticated user reads; only admin writes — falls under the general `admin.manage_lookups` bucket in `lib/permissions.ts`, same as `key_stages` (no dedicated `department.*` row on the client's Role-Based Access screen).

Referenced only by `profiles.department_id`, a nullable FK with `on delete set null` — deleting a department clears it from every user who had it instead of blocking the delete or cascading. Deliberately **not** referenced by `tasks` — a task's department is read via its assignee's `profile.department_id`, not stored redundantly on the task itself.

### `tasks`
*Migration: `0006_tasks.sql`. The core entity — spreadsheet grid, calendar, Gantt/Timeline, and dashboards all read from this table.*

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `task_name` | text | |
| `season_id` | uuid, FK → `seasons.id`, not null | |
| `brand_id` | uuid, FK → `brands.id`, not null | |
| `key_stage_id` | uuid, FK → `key_stages.id`, nullable, `on delete set null` | optional — a task isn't required to belong to a key stage |
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

**Deliberately not columns (this pass):** attachments (explicitly deferred).

**Locking — columns exist, behavior doesn't yet.** `is_locked`/`locked_by`/`locked_at` were added in `0007_tasks_tracking_and_timeline.sql` alongside the other tracking columns, but nothing sets or enforces them yet (no toggle action, no RLS restriction, no disabled-field UI). `lib/permissions.ts` already has `task.lock`/`task.edit_due_date_when_locked` actions reserved for when that follow-up lands.

**RLS — the one table that isn't the simple admin-only-write pattern:** any authenticated user reads (`task.view` is granted to every role). Insert/update require `standard_user` or `admin` (`current_user_role() in ('standard_user', 'admin')`), matching `task.create`/`task.update` in `lib/permissions.ts`. Delete stays admin-only (`task.delete` isn't in `STANDARD_USER_ALLOWED`).

### `task_people`
*Migration: `0010_task_people.sql`. "People Involved" — many-to-many between `tasks` and `profiles`, distinct from the single `tasks.assignee_id` ("Owner / Assignee"). Join table, not an array column, so it reads as an embedded resource like every other relationship here.*

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `task_id` | uuid, FK → `tasks.id`, not null, `on delete cascade` | |
| `profile_id` | uuid, FK → `profiles.id`, not null, `on delete cascade` | |
| `created_at` | timestamptz | |

`unique (task_id, profile_id)` — no duplicate associations.

**RLS:** same matrix as `tasks` itself — any authenticated user reads; add/remove requires `standard_user` or `admin` (`current_user_role() in ('standard_user', 'admin')`), matching `task.assign` in `lib/permissions.ts`.

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
| `0011_profiles_smart_search.sql` | Enables `pg_trgm`, adds trigram GIN indexes on `profiles.full_name`/`profiles.email`, and adds `search_profiles()` — word-by-word + fuzzy-matched, relevance-ranked profile search for the People Involved picker. Deployed but no longer called — see the function's note above. |

## Not built yet

Templates, holidays, leave, reminder rules, notifications log, sales toolkit links, audit log — see `plan.md` §4 for the original full sketch. Add each here as its migration lands.
