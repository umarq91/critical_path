-- Seed data for the seasons table — NOT a migration, don't number/apply this like one.
-- Run it manually via the Supabase SQL editor.
--
-- REPLACES the previous invented sample seasons. Like seed-departments.sql, every row here is
-- real client data: the 28 distinct values of the SEASON column in
-- `Critical Path - Data exported 24th August 2026.xlsx` (TASKS sheet).
--
-- ⚠️ THIS DELETES DATA. Read the "clear-out" block below before running — `tasks` and
-- `brand_seasons` both reference `seasons` with a restricting FK, so seasons cannot be
-- deleted while any row points at them. The deletes are ordered accordingly and WILL remove
-- every task currently in the database.
--
-- Derivations, so these are auditable rather than magic:
--   season_code  Verbatim from the sheet, apostrophes and all — a CSV import of that export
--                matches this column on exact string, so don't normalise the casing. Note the
--                client's own inconsistency is preserved: `RJ'S H1'27` (upper) vs `RJ's H2'27`
--                (lower). Fix it in the source sheet, not here, or the import stops matching.
--   season_name  Human-readable expansion for display. `RES` → `Resort`, month abbreviations
--                spelled out. `RIP CURL` / `RJ'S` / `RW` are left as-is — they look like brand
--                prefixes and expanding them would be a guess.
--   start_date   Earliest, and end_date the latest, of that season's task Working Timeline
--   end_date     start/end and DUE DATE values. The sheet has no season-level date range of
--                its own, so this is the tightest interval that actually contains its tasks.
--   status       Computed against 2026-09-02 (the date this was generated), not stored in the
--                sheet: end_date past → completed, spanning today → active, wholly future →
--                upcoming. It's a snapshot — re-derive it if you seed this much later.
--   color        Cycles VIZ_COLORS (src/constants/chart-colors.ts) in the order below, same as
--                seed-brands.sql. The export's "Calendar Colour Table" sheet does carry a
--                per-season colour, but it's a Google Calendar colorId (1–11) cycling in plain
--                sequence with no grouping intent, and those hexes aren't design tokens — so
--                cycling our own palette loses nothing and keeps <ColorField> able to show it.

begin;

-- Clear-out. Order matters: brand_seasons.season_id is `on delete restrict`
-- (0013_brand_seasons.sql) and tasks.season_id is a plain NOT NULL FK, so both must go first.
delete from public.task_people;
delete from public.tasks;
delete from public.brand_seasons;
delete from public.seasons;

insert into public.seasons (season_code, season_name, start_date, end_date, status, color)
values
  ('RES H2''26'             , 'Resort H2 2026'                 , '2025-09-15', '2026-08-01', 'completed', '#2b6ef6'),
  ('Q3''26'                 , 'Q3 2026'                        , '2025-03-14', '2026-08-01', 'completed', '#1fbf75'),
  ('RIP CURL Q3''26'        , 'Rip Curl Q3 2026'               , '2025-09-19', '2026-08-24', 'completed', '#f5a524'),
  ('AUG ''26 INJECTION'     , 'August 2026 Injection'          , '2025-12-10', '2026-08-24', 'completed', '#f0463c'),
  ('SEP ''26 INJECTION'     , 'September 2026 Injection'       , '2026-02-02', '2026-07-14', 'completed', '#14b8a6'),
  ('Q4''26'                 , 'Q4 2026'                        , '2025-06-20', '2026-10-13', 'active'   , '#8b5cf6'),
  ('OCT ''26 INJECTION'     , 'October 2026 Injection'         , '2026-03-02', '2026-10-13', 'active'   , '#6366f1'),
  ('NOV ''26 INJECTION'     , 'November 2026 Injection'        , '2026-04-01', '2026-09-18', 'active'   , '#2b6ef6'),
  ('DEC ''26 INJECTION'     , 'December 2026 Injection'        , '2026-04-15', '2026-10-12', 'active'   , '#1fbf75'),
  ('Q1''27 / H1''27'        , 'Q1 / H1 2027'                   , '2025-10-03', '2026-12-30', 'active'   , '#f5a524'),
  ('RJ''S H1''27'           , 'RJ''s H1 2027'                  , '2026-02-01', '2027-01-13', 'active'   , '#f0463c'),
  ('FEB/ MAR ''27 INJECTION', 'February / March 2027 Injection', '2026-02-01', '2027-02-10', 'active'   , '#14b8a6'),
  ('Q2''27'                 , 'Q2 2027'                        , '2025-12-19', '2027-03-23', 'active'   , '#8b5cf6'),
  ('RW Q2''27'              , 'RW Q2 2027'                     , '2026-05-08', '2027-03-23', 'active'   , '#6366f1'),
  ('APR ''27 INJECTION'     , 'April 2027 Injection'           , '2026-07-01', '2027-03-23', 'active'   , '#2b6ef6'),
  ('MAY ''27 INJECTION'     , 'May 2027 Injection'             , '2026-07-13', '2027-04-15', 'active'   , '#1fbf75'),
  ('JUNE ''27 INJECTION'    , 'June 2027 Injection'            , '2026-07-27', '2027-05-17', 'active'   , '#f5a524'),
  ('Q3''27 / H2''27'        , 'Q3 / H2 2027'                   , '2026-03-27', '2027-06-28', 'active'   , '#f0463c'),
  ('RJ''s H2''27'           , 'RJ''s H2 2027'                  , '2026-07-10', '2027-06-28', 'active'   , '#14b8a6'),
  ('JULY ''27 INJECTION'    , 'July 2027 Injection'            , '2026-08-12', '2027-06-07', 'active'   , '#8b5cf6'),
  ('AUG ''27 INJECTION'     , 'August 2027 Injection'          , '2026-10-08', '2027-07-15', 'upcoming' , '#6366f1'),
  ('SEP ''27 INJECTION'     , 'September 2027 Injection'       , '2026-11-06', '2027-08-25', 'upcoming' , '#2b6ef6'),
  ('Q4''27'                 , 'Q4 2027'                        , '2026-05-29', '2027-09-23', 'active'   , '#1fbf75'),
  ('OCT ''27 INJECTION'     , 'October 2027 Injection'         , '2026-12-14', '2027-09-15', 'upcoming' , '#f5a524'),
  ('NOV ''27 INJECTION'     , 'November 2027 Injection'        , '2027-01-08', '2027-10-15', 'upcoming' , '#f0463c'),
  ('DEC ''27 INJECTION'     , 'December 2027 Injection'        , '2027-02-05', '2027-11-15', 'upcoming' , '#14b8a6'),
  ('RES H1''27'             , 'Resort H1 2027'                 , '2026-02-11', '2027-01-01', 'active'   , '#8b5cf6'),
  ('RES H2''27'             , 'Resort H2 2027'                 , '2026-07-06', '2027-08-01', 'active'   , '#6366f1');

commit;

-- AFTER RUNNING: seed-brands.sql's brand_seasons block hardcodes the OLD season UUIDs and is
-- now dead — those ids no longer exist. The brands themselves survive (nothing above touches
-- them), only their season links were cleared. Re-link by season_code instead of pasting new
-- UUIDs, e.g.:
--
--   insert into public.brand_seasons (brand_id, season_id)
--   select b.id, s.id
--   from public.brands b
--   join public.seasons s on s.season_code = 'Q3''26'
--   where b.brand_code = 'BR-A';
