-- Dev/test seed data for the seasons table — NOT a migration, don't number/apply this like
-- one. Run it manually via the Supabase SQL editor when you want sample rows to test the
-- /seasons page (pagination, filters, sorting) against real data.
--
-- owner_id is left NULL for every row (no real profile UUIDs to reference here without
-- guessing — a wrong FK value would fail the whole insert). Backfill it yourself, e.g.:
--   update public.seasons set owner_id = '<your-profile-id>' where owner_id is null;
--
-- Colors cycle through the same VIZ_COLORS palette the app's <ColorField> offers
-- (src/constants/chart-colors.ts), so these look like real choices, not placeholders.

insert into public.seasons (season_code, season_name, status, start_date, end_date, color)
values
  ('RES H1''24',   'Spring/Summer 2024',           'completed', '2024-01-01', '2024-06-30', '#2b6ef6'),
  ('RES H2''24',   'Autumn/Winter 2024',           'completed', '2024-07-01', '2024-12-31', '#1fbf75'),
  ('RES H1''25',   'Spring/Summer 2025',           'completed', '2025-01-01', '2025-06-30', '#f5a524'),
  ('RES H2''25',   'Autumn/Winter 2025',           'completed', '2025-07-01', '2025-12-31', '#f0463c'),
  ('RES H1''26',   'Spring/Summer 2026',           'completed', '2026-01-01', '2026-06-30', '#14b8a6'),
  ('RES H2''26',   'Autumn/Winter 2026',           'active',    '2026-07-01', '2026-12-31', '#8b5cf6'),
  ('RES H1''27',   'Spring/Summer 2027',           'upcoming',  '2027-01-01', '2027-06-30', '#6366f1'),
  ('RES H2''27',   'Autumn/Winter 2027',           'planning',  '2027-07-01', '2027-12-31', '#2b6ef6'),
  ('EU H1''26',    'Europe Spring/Summer 2026',    'completed', '2026-01-15', '2026-06-15', '#1fbf75'),
  ('EU H2''26',    'Europe Autumn/Winter 2026',    'active',    '2026-07-15', '2026-12-15', '#f5a524'),
  ('US H1''26',    'US Spring/Summer 2026',        'completed', '2026-02-01', '2026-07-31', '#f0463c'),
  ('US H2''26',    'US Autumn/Winter 2026',        'active',    '2026-08-01', '2027-01-31', '#14b8a6'),
  ('APAC H1''26',  'APAC Spring/Summer 2026',      'active',    '2026-03-01', '2026-08-31', '#8b5cf6'),
  ('APAC H2''26',  'APAC Autumn/Winter 2026',      'upcoming',  '2026-09-01', '2027-02-28', '#6366f1'),
  ('RES Q1''26',   'Resort Q1 2026',                'completed', '2026-01-01', '2026-03-31', '#2b6ef6'),
  ('RES Q2''26',   'Resort Q2 2026',                'completed', '2026-04-01', '2026-06-30', '#1fbf75'),
  ('RES Q3''26',   'Resort Q3 2026',                'active',    '2026-07-01', '2026-09-30', '#f5a524'),
  ('RES Q4''26',   'Resort Q4 2026',                'upcoming',  '2026-10-01', '2026-12-31', '#f0463c'),
  ('HOL''26',      'Holiday 2026',                  'upcoming',  '2026-11-01', '2026-12-31', '#14b8a6'),
  ('PRE-SS''27',   'Pre-Launch Spring/Summer 2027', 'planning',  '2027-01-01', '2027-02-28', '#8b5cf6');
