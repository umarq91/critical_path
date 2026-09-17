# 0001. Public holidays: sync, manual management, and Calendar display

**Date**: 2026-09-17
**Status**: Proposed

## Summary

This decision adds public holidays for Australia, China, India, and Turkey to the app. A nightly
job pulls them from an external provider (Calendarific), an admin can also add, edit, or delete
one by hand, and every signed in user sees them as small labels on the Calendar with a filter to
show or hide a country. It does not change how task due dates or overdue status are calculated.
Holidays are informational only in this pass.

## Rationale

Reasoning and options: see [rationale.md](rationale.md).

## Feature design

**Data model sketch**:

| Table | Field | Type | Notes |
|---|---|---|---|
| `public_holidays` | `id` | uuid, PK | |
| | `country` | enum `holiday_country`: `AU`, `CN`, `IN`, `TR` | fixed 4 countries |
| | `holiday_date` | date, not null | |
| | `name` | text, not null | e.g. "Australia Day" |
| | `source` | enum `holiday_source`: `api`, `manual` | records who wrote the row |
| | `created_at` / `updated_at` | timestamptz | standard |

Unique on `country, holiday_date, name`. This allows more than one named holiday on the same day
for the same country, and it also serves as the sync job's upsert key so a re run never duplicates
a row.

No `deleted_at` (hard delete). Nothing else in the schema references a holiday by foreign key, so
there is no history worth preserving by keeping a soft deleted row around.

No `created_by`. This matches every other lookup table (Seasons, Key Stages), which don't track
who created a row either.

**State transitions**: none. A holiday has no lifecycle beyond existing or not. `source` records
who wrote it; it is not a status.

**API surface**:

| Endpoint / action | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `/api/cron/holiday-sync` | GET/POST | `Authorization: Bearer CRON_SECRET` header | `{ synced: { AU: 12, CN: 11, ... }, failed: ["TR"] }` | cron shared secret (`requireCronAuth`) | 401 wrong or missing secret |
| `createHoliday` (Server Action) | none | `country`, `holiday_date`, `name` | the created row | `admin.manage_lookups` | 403 forbidden, 422 invalid input, 409 duplicate |
| `updateHoliday` (Server Action) | none | `id`, patch fields | the updated row | `admin.manage_lookups` | 403, 404, 422 |
| `deleteHoliday` (Server Action) | none | `id` | ok | `admin.manage_lookups` | 403, 404 |
| `listHolidays` (`data/holidays.ts`) | none | `page`, `pageSize`, `sortBy`, `sortDir`, `filters: { country, source }` | `{ data, rowCount }` | page gated on `lookups.view` | none |
| `listHolidaysByDateRange` (`data/holidays.ts`) | none | `from`, `to`, `countries[]` | `Holiday[]` | any authenticated user, no capability gate | none |

**Value sourcing**:

| Action | Value produced / displayed | Source |
|---|---|---|
| Calendar render | a holiday's date and name for each visible day | `public_holidays` row via `listHolidaysByDateRange`, ranged by the Calendar's own visible window (`calendar-utils.ts`'s `getCalendarRange`) |
| Calendar country filter | which countries are currently shown | a new `countries` key in the Calendar's existing nuqs backed search params (`calendar-search-params.ts`), defaulting to all 4 |
| Admin holidays list | the paginated row set | `listHolidays()` with `queryState` parsed from the URL, same shape as `listSeasons` |
| Sync job | which countries to fetch | a fixed `HOLIDAY_COUNTRIES = ["AU","CN","IN","TR"]` constant, not configurable in this pass (see the country list decision) |
| Sync job | which years to fetch | the current year and next year, computed from the server's clock when the job runs |
| Sync job | the Calendarific API key | `process.env.PUBLIC_HOLIDAY_API_KEY`, read through a new `getPublicHolidayApiEnv()` in `lib/env.server.ts` |
| Sync job | which of Calendarific's returned entries count as a public holiday | a fixed `ACCEPTED_HOLIDAY_TYPES = ["National holiday"]` constant. Calendarific tags each entry with a `type` (national holiday, observance, religious, local). Only `"National holiday"` entries are kept; everything else is dropped before the upsert |
| `createHoliday` / `updateHoliday` / `deleteHoliday` | the acting admin | `requirePermission("admin.manage_lookups")`'s resolved user. Not stored on the row, since there is no `created_by` column |
| `updateHoliday` | the row's `source` after the edit | always set to `"manual"` by `updateHoliday`, regardless of what the row's `source` was before the edit |

**Key invariants**:
- A holiday's `country` is always one of the 4 fixed values. There is no fifth value or free
  text.
- `(country, holiday_date, name)` is always unique. The sync job's upsert and the manual create
  path both go through the same constraint, so neither can silently duplicate a row.
- For each country and year it fetches, the sync job deletes every existing `source = 'api'` row
  for that country and year, then inserts the fresh set it just pulled. This is scoped strictly
  to `source = 'api'`, so a `source = 'manual'` row is never touched no matter what its date or
  name is. This is what lets a corrected floating holiday (the provider returning a different
  date for the same named holiday) replace the old entry instead of sitting alongside it forever.
- Editing a holiday through `updateHoliday` always sets its `source` to `"manual"`, even if it
  was `"api"` before the edit. Without this, an admin's correction to a synced holiday would keep
  its `source = 'api'`, and the next night's delete and reinsert (the rule above) would wipe out
  the correction and bring back the original, uncorrected row.

**Security model**:
- Viewing a holiday on the Calendar requires no capability beyond being signed in. Every role,
  including `external`, sees it. A public holiday date is not organisation sensitive the way a
  brand or season list is.
- Viewing the admin `/holidays` management list requires `lookups.view` (admin, standard_user,
  viewer, the same set that can see Seasons and Brands today).
- Creating, editing, or deleting a holiday requires `admin.manage_lookups` (admin only), enforced
  in the Server Action and mirrored by RLS on `public_holidays` (any authenticated row reads,
  only admin writes).
- The sync route is authenticated by a shared secret (`requireCronAuth`), not a user session,
  since its caller is Supabase `pg_cron`/`pg_net`, never a browser.
- No PII, no regulated data. No compliance scope applies.

**Configuration required**:
- `PUBLIC_HOLIDAY_API_KEY`: the Calendarific API key. Read through a null if unset accessor
  (`getPublicHolidayApiEnv()`), matching the existing Google service account pattern in
  `lib/env.server.ts`. The sync route logs and no ops per country while this is unset, rather
  than crashing, so the rest of the feature can be built and deployed before the client actually
  provisions the key.

**Critical test scenarios**:
- Happy path: the nightly sync pulls AU, China, India, and Turkey holidays for the current and
  next year, upserts them, and the Calendar shows them correctly with all 4 countries checked by
  default. Verifies **AC-1**, **AC-2**, **AC-3**, **AC-4**, **AC-5**, **AC-10**.
- Failure case: the Calendarific call for Turkey times out while the other 3 countries succeed.
  AU, China, and India still commit, Turkey's failure is logged, and the next night's run retries
  Turkey on its own. Verifies **AC-8**.
- Failure case: running the sync twice for the same country and year does not create duplicate
  rows. Verifies **AC-7**.
- Manual override: an admin adds a holiday by hand. The next sync for that country and year
  neither removes it nor collides with it, since the delete and reinsert step only ever touches
  `source = 'api'` rows. Verifies **AC-6**, **AC-7**.
- Corrected holiday: the provider returns a different date for the same named holiday than it
  did last time (a floating holiday correction). The next sync deletes the old `source = 'api'`
  row for that country and year and inserts the corrected one, leaving exactly one row, not two.
  Verifies **AC-7**.
- Edited synced holiday: an admin edits a holiday that the sync originally wrote. The edit sets
  its `source` to `manual`, so the next sync (which only deletes and reinserts `source = 'api'`
  rows) leaves the edited row untouched. Verifies **AC-11**.
- Auth/permission: a standard_user or viewer sees holidays on the Calendar and can open the
  `/holidays` list, but has no create/edit/delete controls, and a direct call to `createHoliday`
  from that role is rejected. Verifies **AC-9**.

## Requirements

**User stories**:
- As an admin, I want to see and manage public holidays for Australia, China, India, and Turkey,
  so the organisation has accurate, country specific holiday data even when the automatic sync
  misses or mis dates something.
- As any signed in user, including an external collaborator, I want to see public holidays
  overlaid on the Calendar, filterable by country, so I can plan around them.

**Acceptance criteria**:
- **AC-1**: Australia's public holidays sync automatically and display correctly on the Calendar.
- **AC-2**: China's public holidays sync automatically and display correctly on the Calendar.
- **AC-3**: India's public holidays sync automatically and display correctly on the Calendar.
- **AC-4**: Turkey's public holidays sync automatically and display correctly on the Calendar.
- **AC-5**: The Calendar has a country filter (checkboxes for the 4 countries, all checked by
  default) that shows or hides holiday labels per country, independent of the Season, Brand, and
  Status task filters already on that page.
- **AC-6**: An admin can manually add, edit, and delete a holiday for any of the 4 countries,
  independent of whether the sync job has run.
- **AC-7**: Re running the sync job never creates a duplicate row for a holiday it already wrote.
- **AC-8**: A sync failure for one country does not block the other 3 from committing their data.
  The failure is written to server logs only, not surfaced elsewhere in the UI.
- **AC-9**: Someone who isn't an admin (standard_user, viewer, or external) can view holidays on the Calendar and
  the admin holidays list, but cannot create, edit, or delete one, in the UI or via a direct
  Server Action call.
- **AC-10**: Holiday data stays populated for the current year and next year at all times. The
  sync job's rolling window advances automatically as the calendar year turns over.
- **AC-11**: If an admin edits a holiday that the sync job originally created, the next sync run
  does not revert or duplicate that edit.

## Decision

**Chosen option**: Option 1: Calendarific as the single provider for all 4 countries.

Sync every one of the 4 fixed countries from Calendarific, behind a swappable
`lib/holidays/provider.ts` interface, on the existing Supabase `pg_cron`/`pg_net` scheduling
infrastructure already used by `task-reminders`.

## Build plan

1. Migration: `holiday_country` and `holiday_source` enums plus the `public_holidays` table
   (unique on `country, holiday_date, name`, RLS: any authenticated user reads, only admin
   writes). Foundation for all of **AC-1** to **AC-11**.
2. `lib/env.server.ts`: add `getPublicHolidayApiEnv()` reading `PUBLIC_HOLIDAY_API_KEY`, null if
   unset. Satisfies **AC-1** to **AC-4** (config prerequisite).
3. `lib/holidays/provider.ts` (the swappable interface) and `lib/holidays/calendarific.ts` (the
   concrete implementation: one call per country per year, mapped to `{ date, name }` pairs,
   keeping only entries whose Calendarific `type` is `"National holiday"` per the fixed
   `ACCEPTED_HOLIDAY_TYPES` constant). Satisfies **AC-1** to **AC-4**.
4. `src/app/api/cron/holiday-sync/route.ts`. `requireCronAuth` first line, then loop the 4 fixed
   countries times [current year, next year], call the provider per country in its own try/catch
   so one failure never blocks the others. For each country and year that succeeds, delete every
   existing `source = 'api'` row for that country and year, then insert the fresh set (never
   touching `source = 'manual'` rows). Log any failure for that country. Satisfies **AC-1** to **AC-4**,
   **AC-7**, **AC-8**, **AC-10**, **AC-11**.
5. One time manual `cron.schedule(...)` SQL step per environment (dev, staging, prod), matching
   the `task-reminders` precedent. Not part of the checked in migration, documented in
   `things-to-know.md` instead. Satisfies **AC-1** to **AC-4**, **AC-10**.
6. `data/holidays.ts`: `listHolidays(params)` (paginated, admin page) and
   `listHolidaysByDateRange({ from, to, countries })` (Calendar, range bounded, not paginated,
   same shape as `listTasksByDueDateRange`). Satisfies **AC-5**, **AC-6**.
7. A zod schema for the manual create/update form (country, holiday_date, name). Satisfies
   **AC-6**.
8. `app/(app)/holidays/`: `page.tsx` (`<DataTable>`, `requirePageAccess("lookups.view")`),
   `columns.tsx`, `_actions.ts` (`createHoliday`, `updateHoliday`, `deleteHoliday`, each gated on
   `admin.manage_lookups`; `updateHoliday` always sets the row's `source` to `"manual"` on save,
   regardless of what it was before), and a `<FormDialog>` composing the existing
   `components/form-fields/*`. Satisfies **AC-6**, **AC-9**, **AC-11**.
9. Add "Holidays" to `constants/nav.ts` (`requiredAction: "lookups.view"`) and
   `constants/search-index.ts`. Satisfies **AC-9** at the presentation layer.
10. Calendar integration: a `countries` key in `calendar-search-params.ts` and
    `calendar-query-state.ts` (default: all 4), fetch holidays alongside tasks in
    `calendar/page.tsx`, render a small labeled chip per holiday in `calendar-board.tsx`, add the
    country checkboxes to `calendar-toolbar.tsx`. Satisfies **AC-1** to **AC-5**.
11. `loading.tsx` for `/holidays`, matching the Seasons reference skeleton.
12. Update `supabase/schema.md` and `things-to-know.md` with a new Holidays section: the sync
    window, the accepted holiday type filter, the delete and reinsert rule scoped to
    `source = 'api'`, how editing a synced holiday converts it to `source = 'manual'`, and the
    permission split between viewing on the Calendar and managing the admin list.

## Consequences

**Positive**:
- Every client acceptance criterion (the 4 country sync rows plus filtering) is directly
  buildable from this spec.
- An admin has a manual fallback the day the API misses or mis dates a regional observance,
  without waiting on a code change.
- The swappable provider interface means a future provider swap (coverage, pricing, reliability)
  is a new file behind the same interface, not a rewrite of the sync route or the schema.

**Negative / tradeoffs**:
- Calendarific needs a paid signup API key (free tier). That is a manual step outside this
  codebase. Until `PUBLIC_HOLIDAY_API_KEY` is set, the sync route logs and no ops rather than
  populating real data.
- Holidays do not affect due date or overdue calculation in this pass. A task due on a public
  holiday is still simply due that day. Wiring that in later needs its own decision first, since
  nothing in this schema associates a task, profile, or department with a country today.
- The free tier's 500 requests a month is comfortable at today's volume (4 countries times 2
  years a night, about 8 calls a night, about 240 a month), but would need revisiting if the
  country list grows.

**Neutral**:
- Fully additive. One new migration, one new env var, no existing table, route, or page is
  changed beyond adding a nav entry and a Calendar filter control.

## Follow-up

- [ ] Get a Calendarific API key and set `PUBLIC_HOLIDAY_API_KEY` in each environment before the
      sync produces real data.
- [ ] Run the one time `cron.schedule(...)` SQL step per environment once deployed, per
      `things-to-know.md`'s Reminders section precedent.
- [ ] If the client later wants holidays to affect overdue or business day math, treat that as a new
      decision (`/architect`), not an ad hoc addition. It needs a country association on tasks or
      departments that does not exist yet.
- [ ] No `docs/scope/` entry exists yet for this feature (the project has not adopted `/scope`).
      Consider enrolling one so `/develop` has a feature row to advance through its build states.

## References

**Project sources** (verifiable, in this repo):
- `CLAUDE.md`, the cron section and the `PUBLIC_HOLIDAY_API_KEY` placeholder already named in the
  environment list
- `things-to-know.md`, the Reminders section (the `pg_cron`/`pg_net` wiring this sync job reuses)
- `plan.md`, the original public holidays requirement (country list, manual override intent)
- `lib/env.server.ts`, the null if unset credential accessor pattern (`getGoogleServiceAccountEnv`)
- `data/seasons.ts` and `app/(app)/seasons/`, the reference `<DataTable>` plus `<FormDialog>`
  lookup pattern this feature's admin page reuses

**Practices & standards**:
- Idempotent upsert keyed on a natural uniqueness constraint, for a job that runs on a schedule
  and must survive being re run or retried

**Links** (web verified):
- Nager.Date public holiday API: https://date.nager.at. Verified directly during this design; its
  `AvailableCountries` endpoint confirms AU, CN, and TR, and confirms India is not covered.
- Calendarific: https://www.calendarific.com. Confirmed via research to cover AU, CN, IN, and TR,
  with a free tier of 500 requests a month.
