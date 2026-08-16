-- Brands — a stable lookup entity tasks reference (via a future tasks.brand_id), matching
-- the client's actual Role-Based Access screen which grants Brands its own granular
-- view/manage/delete permissions (see lib/permissions.ts's brand.* actions), unlike seasons
-- which still falls under the general admin.manage_lookups bucket.
-- Every brand belongs to exactly one season (confirmed requirement).
-- Tasks count shown on the admin Brands page is deliberately NOT a column here — same
-- reasoning as seasons.ts: computed from `tasks` once that table exists.

create type public.brand_status as enum ('active', 'inactive');

create table public.brands (
  id uuid primary key default gen_random_uuid(),
  brand_code text not null unique,
  brand_name text not null,
  description text,
  status public.brand_status not null default 'active',
  color text not null default '#2b6ef6',
  -- Restrict, not cascade/set null — seasons are soft-deleted (deleted_at) rather than
  -- hard-deleted, so a season row disappearing out from under a brand shouldn't happen.
  season_id uuid not null references public.seasons (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index brands_status_idx on public.brands (status);
create index brands_season_id_idx on public.brands (season_id);

create trigger brands_set_updated_at
  before update on public.brands
  for each row
  execute function public.set_updated_at();

alter table public.brands enable row level security;

-- Every signed-in user reads brands (task grid filters, dashboards) — matches brand.view
-- being granted to every role in lib/permissions.ts. Only admins manage the list itself.
create policy brands_select_authenticated
  on public.brands
  for select
  to authenticated
  using (true);

create policy brands_write_admin
  on public.brands
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());
