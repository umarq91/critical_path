-- Brands can now belong to multiple seasons — replaces the 1:1 brands.season_id column
-- (0005_brands.sql) with a join table, same shape as task_people (0010_task_people.sql).
--
-- Written idempotently (if not exists / guarded DO blocks) so it's safe to paste into the
-- SQL Editor and run again even if an earlier run already got partway through — every
-- statement below is a no-op on anything already applied.

create table if not exists public.brand_seasons (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands (id) on delete cascade,
  -- Restrict, not cascade — same reasoning brands.season_id originally had: seasons are
  -- soft-deleted (deleted_at), not hard-deleted, so a season row disappearing out from
  -- under a brand association shouldn't happen.
  season_id uuid not null references public.seasons (id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (brand_id, season_id)
);

create index if not exists brand_seasons_season_id_idx on public.brand_seasons (season_id);

-- Carry forward every existing 1:1 brand->season link before the column is dropped. Guarded
-- because brands.season_id won't exist at all on a rerun after the drop below has already
-- happened once.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'brands' and column_name = 'season_id'
  ) then
    insert into public.brand_seasons (brand_id, season_id)
    select id, season_id from public.brands where season_id is not null
    on conflict (brand_id, season_id) do nothing;
  end if;
end $$;

alter table public.brands drop column if exists season_id;

alter table public.brand_seasons enable row level security;

-- Same matrix as brands itself (and task_people) — any authenticated user reads, only admin
-- writes, since this is governed by the same brand.manage/brand.delete permissions as the
-- brand row it belongs to.
drop policy if exists brand_seasons_select_authenticated on public.brand_seasons;
create policy brand_seasons_select_authenticated
  on public.brand_seasons
  for select
  to authenticated
  using (true);

drop policy if exists brand_seasons_write_admin on public.brand_seasons;
create policy brand_seasons_write_admin
  on public.brand_seasons
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());
