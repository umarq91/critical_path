-- Seasons no longer carry a status in the app (client decision): the form, table, filter, stat
-- cards, Upcoming Seasons panel and export dropped it, and createSeason writes nothing, so new
-- rows are null. Existing rows keep their status. The default goes too, or every new season
-- would silently be stamped `planning`. The season_status enum stays (old rows still use it).

alter table public.seasons
  alter column status drop default,
  alter column status drop not null;
