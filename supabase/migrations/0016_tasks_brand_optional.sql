-- Brand becomes optional on a task. `season_id` stays required — a task always belongs to a
-- season's critical path, but plenty of stage work (trend trips, range reviews, shipping
-- coordination) isn't specific to one brand, and the client's export has no BRAND column at
-- all: brand is inferred from the season name on the few brand-specific seasons
-- ("RIP CURL Q3'26", "RJ'S H1'27", "RW Q2'27") and absent everywhere else.
--
-- Only the NOT NULL goes. The FK itself is left alone — still a plain reference with no
-- on-delete clause, i.e. restrict, matching season_id. Brands are soft-deleted (deleted_at),
-- so a brand disappearing out from under a task shouldn't happen; `on delete set null` would
-- silently blank the column instead of surfacing that it did.
--
-- Idempotent — safe to re-run; dropping a NOT NULL that's already gone is a no-op in Postgres.

alter table public.tasks
  alter column brand_id drop not null;
