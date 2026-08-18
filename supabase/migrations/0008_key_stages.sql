-- Key stages — a lightweight lookup entity tasks can optionally be grouped under (e.g. for
-- future Timeline/Gantt row grouping), per schema.md's original "skipped for now, build only
-- if necessary" note on 0006/0007 — now needed. Deliberately minimal: name + description
-- only, no status/color/season link like brands/seasons, matching confirmed scope.
-- Falls under the general admin.manage_lookups permission bucket (lib/permissions.ts), same
-- as seasons — no dedicated key_stage.* row on the client's Role-Based Access screen.

create table public.key_stages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create trigger key_stages_set_updated_at
  before update on public.key_stages
  for each row
  execute function public.set_updated_at();

alter table public.key_stages enable row level security;

create policy key_stages_select_authenticated
  on public.key_stages
  for select
  to authenticated
  using (true);

create policy key_stages_write_admin
  on public.key_stages
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Nullable, on delete set null — unlike season_id/brand_id, a task isn't required to belong
-- to a key stage, and a key stage disappearing shouldn't take its tasks down with it.
alter table public.tasks
  add column key_stage_id uuid references public.key_stages (id) on delete set null;

create index tasks_key_stage_id_idx on public.tasks (key_stage_id);
