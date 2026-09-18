# 0001. Public holidays: manual and bulk entry, Calendar display

**Date**: 2026-09-18
**Status**: In Progress

## Summary

This decision adds public holidays for Australia, China, India, and Turkey to the app. An admin
enters them by hand, one at a time through a form, or many at once through a CSV file they
download a template for, fill in, and upload. Every signed in user then sees them as a tagged
highlight on the Calendar, with a filter to show or hide a country. There is no automatic sync
from an external service. This supersedes the original design in this same spec, which planned a
nightly sync from a paid provider (Calendarific); the client's actual need turned out to be much
simpler once confirmed. It still does not change how task due dates or overdue status are
calculated. Holidays are informational only.

## Rationale

Reasoning and options, including why the original automatic sync plan was dropped: see
[rationale.md](rationale.md).

## Feature design

**Data model sketch**:

| Table | Field | Type | Notes |
|---|---|---|---|
| `public_holidays` | `id` | uuid, PK | |
| | `country` | text, not null | open, not a fixed enum. AU/CN/IN/TR are the 4 known today, offered as suggestions in the form, but adding a 5th country later is a data entry, not a migration (updated: Umar asked for room to grow this, mid build) |
| | `holiday_date` | date, not null | |
| | `name` | text, not null | the event name, e.g. "Australia Day" |
| | `description` | text, nullable | free text, optional |
| | `created_at` / `updated_at` | timestamptz | standard |

Unique on `country, holiday_date, name`. This still allows more than one named holiday on the
same day for the same country (confirmed with Umar directly: manual entry makes this plausible,
not an error to block).

No `source` column anymore. The original design tracked `api` versus `manual` to protect a synced
row from a scheduled job overwriting a hand made correction. With no sync job, every row is
entered the same way, so that whole column and the invariants built around it are gone, not just
unused.

No `deleted_at` (hard delete): nothing else in the schema references a holiday by foreign key, so
there is no history worth preserving by keeping a soft deleted row around. No `created_by`:
matches every other lookup table (Seasons, Key Stages), which don't track who created a row
either.

**State transitions**: none. A holiday has no lifecycle beyond existing or not.

**API surface**:

| Endpoint / action | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `createHoliday` (Server Action) | none | `country`, `holiday_date`, `name`, `description` (optional) | the created row | `admin.manage_lookups` | 403 forbidden, 422 invalid input, 409 duplicate |
| `updateHoliday` (Server Action) | none | `id`, patch fields | the updated row | `admin.manage_lookups` | 403, 404, 422 |
| `deleteHoliday` (Server Action) | none | `id` | ok | `admin.manage_lookups` | 403, 404 |
| `bulkImportHolidays` (Server Action) | none | `FormData` holding one CSV file | `{ results: [{ row, date, name, country, status: "created" \| "duplicate" \| "invalid", error? }] }` | `admin.manage_lookups` | 403 forbidden, 422 no file or file unreadable |
| `listHolidays` (`data/holidays.ts`) | none | `page`, `pageSize`, `sortBy`, `sortDir`, `filters: { country }` | `{ data, rowCount }` | page gated on `lookups.view` | none |
| `listHolidaysByDateRange` (`data/holidays.ts`) | none | `from`, `to`, `countries[]` | `Holiday[]` | any authenticated user, no capability gate | none |

**Value sourcing**:

| Action | Value produced / displayed | Source |
|---|---|---|
| Calendar render | a holiday's date, name, and description for each visible day | `public_holidays` row via `listHolidaysByDateRange`, ranged by the Calendar's own visible window (`calendar-utils.ts`'s `getCalendarRange`) |
| Calendar country filter | which countries are currently shown, and which countries even appear as checkboxes | a new `countries` key in the Calendar's existing nuqs backed search params (`calendar-search-params.ts`), defaulting to unfiltered (show every country); the checkbox list itself comes from `listDistinctHolidayCountries()`, the distinct `country` values actually present in the table, not a fixed 4 item constant |
| Admin holidays list | the paginated row set | `listHolidays()` with `queryState` parsed from the URL, same shape as `listSeasons` |
| "Download CSV Format" button | the template's column headers | a fixed `HOLIDAY_CSV_HEADERS = ["Date", "Event Name", "Description", "Country"]` constant, shared by the download (as the only row) and the upload parser (to match incoming columns) |
| `bulkImportHolidays` | which row in the uploaded file a given result refers to | the row's 1 based position in the parsed CSV, kept alongside its outcome in the returned results array |
| `bulkImportHolidays` | whether a row is a duplicate | a lookup against both the database (existing `country, holiday_date, name` rows) and the rows already accepted earlier in the same upload, so two identical rows in one file are also caught |
| `createHoliday` / `updateHoliday` / `deleteHoliday` / `bulkImportHolidays` | the acting admin | `requirePermission("admin.manage_lookups")`'s resolved user. Not stored on the row, since there is no `created_by` column |

**Key invariants**:
- A holiday's `country` is always one of the 4 fixed values. There is no fifth value or free
  text.
- `(country, holiday_date, name)` is always unique. `createHoliday` and `bulkImportHolidays` both
  go through the same constraint and the same duplicate check, so neither can silently create two
  identical rows.
- A bulk import never fails as a whole because one row is bad. Each row is validated and written
  independently; a bad row is reported in the results with a reason, every good row in the same
  file still gets created.
- The import is capped at `MAX_BULK_HOLIDAY_ROWS = 500` rows per file. A file over that limit is
  rejected outright (422), before any row is processed, with a message naming the limit.

**Security model**:
- Viewing a holiday on the Calendar requires no capability beyond being signed in. Every role,
  including `external`, sees it. A public holiday date is not organisation sensitive the way a
  brand or season list is.
- Viewing the admin `/holidays` management list requires `lookups.view` (admin, standard_user,
  viewer, the same set that can see Seasons and Brands today).
- Creating, editing, deleting, or bulk importing a holiday requires `admin.manage_lookups` (admin
  only), enforced in every Server Action and mirrored by RLS on `public_holidays` (any
  authenticated row reads, only admin writes).
- No PII, no regulated data. No compliance scope applies.

**Configuration required**: none. The original design's `PUBLIC_HOLIDAY_API_KEY` is no longer
needed and has been removed from `CLAUDE.md`.

**Critical test scenarios**:
- Happy path, single add: an admin fills the "Add Holiday" form (date, event name, description,
  country) and the new holiday appears in the admin list and on the Calendar immediately.
  Verifies **AC-6**, **AC-1** to **AC-4**.
- Happy path, bulk add: an admin downloads the CSV template, fills in several rows across
  different countries, uploads it, and sees a results table with every row marked created.
  Verifies **AC-7**, **AC-8**.
- Partial failure, bulk add: a CSV with 5 rows, where row 3 has an invalid date and row 5 repeats
  a holiday that already exists. Rows 1, 2, and 4 are created; row 3 is reported invalid with a
  reason; row 5 is reported as a duplicate. Nothing about the failure of rows 3 and 5 blocks 1, 2,
  and 4. Verifies **AC-9**.
- Edit and delete: an admin edits a holiday's description and later deletes a different one; both
  changes are reflected in the admin list and the Calendar right away. Verifies **AC-10**.
- Auth/permission: a standard_user or viewer sees holidays on the Calendar and can open the
  `/holidays` list, but has no add, edit, delete, or upload controls, and a direct call to
  `createHoliday` or `bulkImportHolidays` from that role is rejected. Verifies **AC-11**.

## Requirements

**User stories**:
- As an admin, I want to add public holidays one at a time or many at once from a spreadsheet, so
  I can set up a full year for all 4 countries quickly instead of one click at a time.
- As any signed in user, including an external collaborator, I want to see public holidays
  overlaid on the Calendar, filterable by country, so I can plan around them.

**Acceptance criteria**:
- **AC-1**: Australia's public holidays display correctly on the Calendar.
- **AC-2**: China's public holidays display correctly on the Calendar.
- **AC-3**: India's public holidays display correctly on the Calendar.
- **AC-4**: Turkey's public holidays display correctly on the Calendar.
- **AC-5**: The Calendar has a country filter (one checkbox per country that actually has a
  holiday entered, all checked by default) that shows or hides holiday labels per country,
  independent of the Season, Brand, and Status task filters already on that page. The checkbox
  list is not limited to 4: a new country typed into a holiday shows up as a new checkbox on its
  own. A holiday renders as a distinct tagged highlight, not
  a plain small label.
- **AC-6**: An admin can add a single holiday through a form (date, event name, description,
  country), and edit or delete an existing one.
- **AC-7**: An admin can download a CSV template with the correct column headers for bulk entry.
- **AC-8**: An admin can upload a filled in CSV file to create many holidays at once.
- **AC-9**: After a bulk upload, a results table shows every row's outcome: created, duplicate, or
  invalid (with a reason). A bad row never blocks the good rows in the same file from being
  created.
- **AC-10**: Editing or deleting a holiday (single add or one that came from a bulk upload) is
  immediately reflected in the admin list and on the Calendar.
- **AC-11**: Someone who isn't an admin (standard_user, viewer, or external) can view holidays on
  the Calendar and the admin holidays list, but cannot add, edit, delete, or bulk import one, in
  the UI or via a direct Server Action call.
- **AC-12** (added after initial build, real scope gap the original design missed): clicking the
  Calendar's existing "Sync to Google" button also pushes every holiday in the sync window to the
  calling user's own Google Calendar, alongside their tasks. Editing a holiday refreshes it on
  every calendar that already has it; deleting one best effort removes it from every calendar
  that does.

## Decision

**Chosen option**: Option 2: fully manual entry (single add plus CSV bulk import), no automatic
sync.

Drop the Calendarific integration, the nightly cron job, and the whole `api`/`manual` source
tracking entirely. An admin is the only source of holiday data, either through a form or a CSV
file, using the `papaparse` library (already named as the project's intended CSV tool in
`CLAUDE.md`, though never installed) to parse an uploaded file server side inside the same Server
Action that validates and writes it.

## Build plan

1. Migration: the `public_holidays` table (`id`, `country` as plain `text` not an enum, so a new
   country is a row, not a migration, `holiday_date`, `name`, `description` nullable,
   `created_at`/`updated_at`; unique on `country, holiday_date, name`; RLS: any authenticated user
   reads, only admin writes). No `holiday_source` column. Foundation for all of **AC-1** to
   **AC-11**.
2. Install `papaparse` and its type declarations.
3. `app/(app)/holidays/schema.ts`: a `holidaySchema` (`holiday_date`, `name`, `description`
   optional, `country`) shared by the single add form and the CSV row validator, so a validation
   rule never has to be written twice.
4. `data/holidays.ts`: `listHolidays(params)` (paginated, admin page),
   `listHolidaysByDateRange({ from, to, countries })` (Calendar, range bounded, not paginated,
   same shape as `listTasksByDueDateRange`), and `listDistinctHolidayCountries()` (the countries
   that actually have at least one holiday, feeding the Calendar filter's checkbox list so it's
   never hardcoded to 4). Satisfies **AC-1** to **AC-5**, **AC-6**.
5. `app/(app)/holidays/_actions.ts`: `createHoliday`, `updateHoliday`, `deleteHoliday` (each
   gated on `admin.manage_lookups`), and `bulkImportHolidays(formData)`: reads the uploaded file,
   parses it with `papaparse`, rejects outright if it has more than `MAX_BULK_HOLIDAY_ROWS = 500`
   rows, then validates and writes each row independently against `holidaySchema` plus the
   duplicate check, building the results array, one entry per row, as it goes. Satisfies **AC-6** to **AC-9**.
6. `app/(app)/holidays/`: `page.tsx` (`<DataTable>`, `requirePageAccess("lookups.view")`),
   `columns.tsx`, a `<FormDialog>` composing `components/form-fields/*` for single add and edit, a
   "Download CSV Format" button using the existing `lib/csv.ts` (`toCsv`/`downloadCsv`) to produce
   a header only template from the same `HOLIDAY_CSV_HEADERS` constant the parser matches against,
   a file upload control wired to `bulkImportHolidays`, and a results table component that renders
   once the upload call returns. Satisfies **AC-6** to **AC-10**.
7. Add "Holidays" to `constants/nav.ts` (`requiredAction: "lookups.view"`) and
   `constants/search-index.ts`. Satisfies **AC-11** at the presentation layer.
8. Calendar integration: a `countries` key in `calendar-search-params.ts` and
   `calendar-query-state.ts` (default: unset, meaning unfiltered), fetch holidays alongside tasks
   in `calendar/page.tsx`, render each as a distinct tagged highlight (not a plain label) in
   `calendar-board.tsx`, add the country checkboxes to `calendar-toolbar.tsx`, sourced from
   `listDistinctHolidayCountries()` rather than a fixed list. Satisfies **AC-1** to **AC-5**.
9. `loading.tsx` for `/holidays`, matching the Seasons reference skeleton.
10. Update `supabase/schema.md` and `things-to-know.md` with a new Holidays section: the data
    model, the CSV template format and its header constant, the duplicate and row cap rules for
    bulk import, and the permission split between viewing on the Calendar and managing the admin
    list. Note in both that the original sync design was dropped, so a reader doesn't go looking
    for a cron route or a provider file that no longer exist.
11. Migration `0028_holiday_calendar_events.sql`: a join table (`holiday_id`, `profile_id`,
    `google_event_id`, unique on the pair). A holiday has no owner column to reuse the way a
    task's own `google_event_id`/`google_calendar_owner_id` does, since it can be pushed to many
    users' calendars independently. Satisfies **AC-12**.
12. Generalize `lib/google/calendar.ts`'s `upsertTaskCalendarEvent`/`deleteTaskCalendarEvent` to
    `upsertCalendarEvent`/`deleteCalendarEvent` (already fully entity agnostic underneath, just
    named after tasks), then add `lib/google/holiday-calendar-sync.ts`
    (`pushHolidayToGoogleCalendar`/`resyncHolidayCalendarEvents`/`deleteHolidayCalendarEvents`)
    mirroring `task-calendar-sync.ts`. Satisfies **AC-12**.
13. Extend `syncGoogleCalendar` (`calendar/_actions.ts`) with a second pass alongside the
    existing task pass: every holiday in the same `[from, to]` window, pushed to the calling
    user's own calendar. No first claim wins rule needed here, unlike tasks: every user gets
    their own copy. Extend `createHoliday`/`updateHoliday`/`deleteHoliday` to resync or best
    effort clean up every affected user's event. Satisfies **AC-12**.

## Consequences

**Positive**:
- No external account, no paid API key, nothing to provision before this can go live. What Umar
  flagged as a real hint (manual entry being likely, given holidays are entered by hand anyway)
  turned out to be exactly right once the client answered.
- Sidesteps the coverage and accuracy risk the original design's Rationale flagged for China and
  Turkey (whether a given free or paid provider models their holidays correctly): there is no
  automated feed to get wrong, since an admin enters exactly what they intend.
- The CSV bulk path makes setting up a full year across 4 countries a five minute task instead of
  dozens of single adds.

**Negative / tradeoffs**:
- Nothing updates automatically. If nobody adds next year's holidays, the Calendar simply shows
  none for that year. This is a real operational risk worth a standing reminder (see Follow-up),
  not a technical gap this spec can close.
- Holidays still do not affect due date or overdue calculation in this pass. A task due on a
  public holiday is still simply due that day.
- If deleting a holiday's best effort Google cleanup fails for a given user (expired token,
  network blip), that one event is stuck on their calendar with no later retry path. The
  tracking row that would let a future sync find and remove it is gone the moment the holiday
  row is (hard delete, no `deleted_at`). A known, accepted tradeoff of the earlier hard delete
  decision, not a new gap this addition introduces.

**Neutral**:
- `papaparse` is a new dependency (previously named as intended in `CLAUDE.md` but never actually
  installed).
- `PUBLIC_HOLIDAY_API_KEY` is no longer used anywhere. Removed from `CLAUDE.md`'s environment
  list rather than left as a dead placeholder.
- `upsertTaskCalendarEvent`/`deleteTaskCalendarEvent` (`lib/google/calendar.ts`) were renamed to
  `upsertCalendarEvent`/`deleteCalendarEvent` to reflect that holidays now share them too. A
  mechanical rename, no behavior change for tasks.

## Follow-up

- [x] Migrations `0027_public_holidays.sql` and `0028_holiday_calendar_events.sql` applied to the
      live Supabase project.
- [x] Removed the unused `PUBLIC_HOLIDAY_API_KEY` placeholder from `CLAUDE.md`'s environment
      section, since nothing in this build reads it.
- [ ] Consider a standing yearly reminder (outside this codebase, e.g. a calendar note for
      whoever administers this) to add next year's holidays before the current year's data runs
      out, since nothing here does that automatically anymore.
- [ ] Two smaller questions from the original client round were never explicitly confirmed again
      after the scope simplified, and this spec carries them forward as the same recommended
      defaults as before, not newly confirmed: holiday visibility (kept as "everyone, including
      external") and the Calendar's default country filter state (kept as "unfiltered, every
      country shown"). Low risk to leave as is and revisit only if it turns out wrong. The third
      question, whether the country list would grow beyond the original 4, is now resolved by
      this update: `country` is open text, not a fixed list, precisely so it can.
- [ ] If the client later wants holidays to affect overdue or business day math, treat that as a
      new decision (`/architect`), not an ad hoc addition. It needs a country association on
      tasks or departments that does not exist yet.
- [ ] No `docs/scope/` entry exists yet for this feature (the project has not adopted `/scope`).
      Consider enrolling one so `/develop` has a feature row to advance through its build states.

## References

**Project sources** (verifiable, in this repo):
- `CLAUDE.md`, the `papaparse` stack entry ("CSV bulk task import") and the
  `PUBLIC_HOLIDAY_API_KEY` placeholder, both named before this feature existed
- `lib/csv.ts` and `lib/export/csv.ts`, the existing CSV serialization and download helpers this
  feature's template download reuses as is
- `data/seasons.ts` and `app/(app)/seasons/`, the reference `<DataTable>` plus `<FormDialog>`
  lookup pattern this feature's admin page reuses
- `lib/export/types.ts`'s `MAX_LOOKUP_EXPORT_ROWS` (1000), the precedent this spec's
  `MAX_BULK_HOLIDAY_ROWS` (500) follows for a bounded bulk operation

**Practices & standards**:
- Partial success with a per row result, rather than an all or nothing transaction, for a bulk
  import a human is directly watching and can immediately correct

**Links**: none carried forward. The provider links from the original design (Nager.Date,
Calendarific, Abstract API) no longer apply to a build with no external provider; see
`rationale.md` for why they're kept there as historical record instead of repeated here.
