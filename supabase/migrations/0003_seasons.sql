-- Seasons — the top-level grouping tasks are organised under (e.g. "RES H2'26" / Winter 2026).
-- Aggregates shown on the admin Seasons page (task counts, completion %, brand counts, owner
-- counts) are deliberately NOT columns here — they're computed from `tasks` once that table
-- exists, the same way dashboard.ts wraps tasks.ts rather than storing denormalized counts.

create type public.season_status as enum ('planning', 'upcoming', 'active', 'completed');

create table public.seasons (
  id uuid primary key default gen_random_uuid(),
  season_code text not null unique,
  season_name text not null,
  status public.season_status not null default 'planning',
  start_date date not null,
  end_date date not null,
  color text not null default '#2b6ef6',
  owner_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint seasons_end_date_after_start_date check (end_date >= start_date)
);

create index seasons_status_idx on public.seasons (status);
create index seasons_owner_id_idx on public.seasons (owner_id);

create trigger seasons_set_updated_at
  before update on public.seasons
  for each row
  execute function public.set_updated_at();

alter table public.seasons enable row level security;

-- Every signed-in user reads seasons (task grid filters, Gantt grouping, dashboards).
-- Only admins manage the list itself.
create policy seasons_select_authenticated
  on public.seasons
  for select
  to authenticated
  using (true);

-- One policy covers insert/update/delete — `for all` also matches select, but that just
-- OR's with seasons_select_authenticated above (already `true`), so read access is
-- unaffected; only write commands are actually gated by is_admin() here.
create policy seasons_write_admin
  on public.seasons
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());
