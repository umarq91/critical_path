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
*Migration: `0005_brands.sql`, `season_id` replaced by `brand_seasons` in `0014_brand_seasons.sql`. Stable brand identity referenced by `tasks.brand_id`.*

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

**RLS:** any authenticated user reads; only admin writes — matches `brand.view` being granted to every role in `lib/permissions.ts`, while `brand.manage`/`brand.delete` stay admin-only (Brands has its own granular row on the client's Role-Based Access screen, unlike most other lookups which still fall under `admin.manage_lookups`).

**Deliberately not a column:** brand's task count — shown on the admin Brands page but computed from `tasks` once that table exists, same reasoning as `seasons`.

### `brand_seasons`
*Migration: `0014_brand_seasons.sql`. "Seasons" on the Brands admin page — many-to-many between `brands` and `seasons`, same join-table shape as `task_people`. Replaces the original `brands.season_id` (not-null FK, one season per brand) once that stopped matching the confirmed requirement.*

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
| `google_event_id` | text, nullable | Google Calendar event id this task is pushed to — set by `syncGoogleCalendar()`, see below |
| `google_calendar_owner_id` | uuid, FK → `profiles.id`, nullable, `on delete set null` | whose Google Calendar `google_event_id` actually lives on (the assignee who last ran Sync) — needed so `deleteTask` cleans up the event on the right account |
| `google_synced_at` | timestamptz, nullable | last time this task's Google Calendar event was pushed to or pulled from — drives the "which side changed more recently" conflict check |
| `created_at` / `updated_at` | timestamptz | |
| `deleted_at` | timestamptz, nullable | soft delete |

**Deliberately not columns (this pass):** attachments (explicitly deferred).

**Google Calendar sync — manual, per-user, assignee-scoped.** `lib/google/calendar.ts` + `calendar/_actions.ts`'s `syncGoogleCalendar()` (triggered by the Calendar page's Sync button, not a cron) pushes a signed-in user's own assigned tasks (`assignee_id = current user`, due date within roughly the surrounding year) to their primary Google Calendar as all-day events, and pulls back any edit to that event's title/date if it changed more recently than `google_synced_at`. Only the assignee's tasks are pushed — one task maps to exactly one `google_event_id`, so it can only live on one person's calendar. Every other event already on that user's calendar (meetings, personal events — anything not created from a task) is cached read-only in `external_calendar_events` below purely for display; it never becomes a task since tasks require `season_id`/`brand_id`/`gender`/`assignee_id` a Google Calendar event doesn't have. `deleteTask` best-effort deletes the linked Google event (via `google_calendar_owner_id`'s account) when a synced task is deleted; failures there don't block the task delete itself.

**Auth for the Calendar API call itself is per-user OAuth (`google_oauth_tokens` below), NOT the domain-wide-delegated service account** used for role sync — see that table's note for why, and why this is meant to be temporary.

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

### `external_calendar_events`
*Migration: `0012_google_calendar_sync.sql`. Read-only cache of a user's Google Calendar events that are NOT linked to one of their tasks (see `tasks.google_event_id` above) — personal data, not shared org data like every other table here.*

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `profile_id` | uuid, FK → `profiles.id`, not null, `on delete cascade` | whose calendar this event was read from |
| `google_event_id` | text, not null | |
| `title` | text, not null | |
| `starts_at` | timestamptz, not null | for an all-day event, midnight UTC on that date |
| `ends_at` | timestamptz, nullable | null for all-day events |
| `all_day` | boolean, default `false` | |
| `last_synced_at` | timestamptz, default `now()` | |
| `created_at` / `updated_at` | timestamptz | |

`unique (profile_id, google_event_id)` — upserted on every sync run; rows in the synced window no longer returned by Google are deleted (see `syncGoogleCalendar()`).

**RLS:** unlike every other table here, not the shared admin-only-write pattern — a single `for all using (profile_id = auth.uid())` policy, since this is one user's own cached calendar data, not organization-wide.

### `google_oauth_tokens`
*Migration: `0013_google_oauth_tokens.sql`. Per-user Google OAuth access/refresh tokens, used only to call the Calendar API as that specific user.*

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

**RLS: zero policies.** RLS is enabled but nothing grants access — not even a `profile_id = auth.uid()` self-read like `external_calendar_events`, since these are live API credentials, not display data. The only access path is `lib/google/oauth-tokens.ts`, which always goes through the service-role client (`lib/supabase/admin.ts`) and scopes every query to a specific `profile_id` in application code.

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
| `0012_google_calendar_sync.sql` | Adds `google_event_id`/`google_calendar_owner_id`/`google_synced_at` to `tasks` for two-way sync, and creates `external_calendar_events` (self-scoped RLS) to cache the rest of a user's Google Calendar read-only. |
| `0013_google_oauth_tokens.sql` | Creates `google_oauth_tokens` (zero RLS policies — service-role-only access) to hold per-user Calendar OAuth tokens. **Temporary** — see that table's note above. |
| `0014_brand_seasons.sql` | Drops `brands.season_id`, creates `brand_seasons` join table (same shape as `task_people`) so a brand can belong to multiple seasons. Migrates existing 1:1 links into the new table before dropping the column. |

## Not built yet

Templates, holidays, leave, reminder rules, notifications log, sales toolkit links, audit log — see `plan.md` §4 for the original full sketch. Add each here as its migration lands.
