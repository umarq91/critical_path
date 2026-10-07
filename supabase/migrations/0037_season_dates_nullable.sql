-- Seasons no longer carry a date range in the app (client decision): the form, table, filters
-- and export dropped Start/End Date, and createSeason writes both as null. Existing rows keep
-- their dates. seasons_end_date_after_start_date stays: a CHECK passes when either side is null.

alter table public.seasons
  alter column start_date drop not null,
  alter column end_date drop not null;
