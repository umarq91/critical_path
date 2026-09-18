# Verify: Public Holidays · spec 0001 · updated 2026-09-18
_Steps derived from spec 0001 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

## UI / manual
- [ ] Sign in as admin → `/holidays` → click "Add Holiday" → fill date, event name, description, country "AU" → submit → holiday appears in the list                    → AC-6
- [ ] On `/calendar`, navigate to the month containing that holiday's date → confirm it shows as a distinct accent-teal tagged chip, not a plain label            → AC-1, AC-5
- [ ] Add one holiday each for CN, IN, TR the same way → confirm each displays on the Calendar                                                                    → AC-2, AC-3, AC-4
- [ ] On the Calendar toolbar, uncheck one country's checkbox → its holidays disappear from the grid, others remain; uncheck every checkbox → every country's holidays reappear (not zero) → AC-5
- [ ] Add a holiday with a country not in the quick-pick list (e.g. "Vietnam") → it appears as its own new checkbox in the Calendar's country filter and its own filter chip on `/holidays`, with no code change needed → AC-5 (value sourcing: open country list)
- [ ] On `/holidays`, click the pencil on an existing row → edit the description → confirm (tick) → change reflected in the list and on `/calendar` immediately    → AC-10
- [ ] Delete a holiday via the row's `⋮` menu → confirm dialog → it disappears from the list and the Calendar                                                     → AC-10
- [ ] Click "Download CSV Format" → open the file → header row reads exactly `Date, Event Name, Description, Country`                                             → AC-7
- [ ] Fill the downloaded template with 3 valid rows across different countries, save, click "Upload CSV" → pick the file → results table shows all 3 as "Created", toast confirms count → AC-8, AC-9
- [ ] Build a CSV with 5 rows: 3 valid, 1 with an unparseable date, 1 that duplicates a holiday already in the database → upload it → results table shows 3 "Created", 1 "Invalid" (with a reason), 1 "Duplicate"; the 3 valid ones are actually present in the list afterward → AC-9
- [ ] Include two identical rows (same date/name/country) within one uploaded file → the first is "Created", the second is "Duplicate" ("repeats an earlier row in this same file") → AC-9
- [ ] Build and upload a CSV with 501 rows → the whole file is rejected up front with a row-limit message, nothing is created → AC-9 (row cap)
- [ ] Sign in as a standard_user or viewer → `/calendar` shows holidays and the country filter works → `/holidays` list opens but shows no "Add Holiday" button, no CSV buttons, and no pencil/delete on any row → AC-11
- [ ] Sign in as an external user → `/calendar` still shows holidays (unrestricted visibility) → confirm `/holidays` itself is inaccessible or read-only per `lookups.view` scoping → AC-11

## Commands
- [ ] `npx tsc --noEmit` → no errors
- [ ] `npm run lint` → no errors, no warnings
- [ ] `npm run build` → succeeds, `/holidays` listed in the route output

## Acceptance-criteria coverage
- AC-1…AC-4 (each country displays correctly) — covered by the per-country add + Calendar check steps
- AC-5 (country filter, distinct tag) — covered by the filter toggle and chip-style steps
- AC-6 (single add/edit/delete) — covered by the add/edit/delete steps
- AC-7 (download template) — covered by the CSV format check
- AC-8 (bulk upload creates holidays) — covered by the valid-file upload step
- AC-9 (per-row results, partial success, row cap) — covered by the mixed-validity, in-file-duplicate, and oversized-file steps
- AC-10 (edits/deletes reflected immediately) — covered by the edit/delete steps
- AC-11 (non-admin view-only, external visibility) — covered by the role-based steps

## Known gap, not covered here
Migration `0027_public_holidays.sql` has not been applied to the live Supabase project in this
environment (no `supabase` CLI / linked project access). None of the steps above can actually run
until it is. Apply it first, then work through this checklist.
