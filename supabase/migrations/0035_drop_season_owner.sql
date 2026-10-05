-- Seasons no longer have an owner (client decision). Nothing in the app or the integration API
-- reads `seasons.owner_id`, so the column, its index and its FK to `profiles` go.

drop index if exists public.seasons_owner_id_idx;
alter table public.seasons drop column if exists owner_id;
