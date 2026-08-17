-- Tasks — the core entity everything else (Seasons, Brands, dashboards, calendar, Gantt) was
-- built to support. Scope deliberately trimmed for this first pass, per current requirements:
--   - key_stage_id is NOT included — Key Stages is skipped for now (see supabase/schema.md's
--     "Not built yet" note); add the column via a follow-up migration if/when that lands.
--   - No separate task_comments table — "Comments" in the UI is just this row's own
--     free-text `notes` field, not a threaded/multi-row comment feed.
--   - No attachments table/column — explicitly skipped for now.
--   - No locking columns (is_locked/locked_by/locked_at) — locking is a distinct feature not
--     requested yet; add alongside that work so it isn't half-built here.
--   - "Owner / Assignee" is a single field (assignee_id), not two — matches both the
--     confirmed UI mockup (one combined column) and the current ask, collapsing plan.md's
--     original owner+assignee sketch to what's actually needed right now.

-- Defensive guard: this migration is the first thing that references the 'standard_user'
-- enum value in a RLS policy. 0002_rename_role_manager_to_standard_user.sql should already
-- have renamed it from 'manager', but if that migration was skipped on this database, do it
-- here too (idempotent — no-ops once 'standard_user' exists) rather than failing below with
-- "invalid input value for enum user_role".
do $$
begin
  if not exists (
    select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid
    where t.typname = 'user_role' and e.enumlabel = 'standard_user'
  ) then
    alter type public.user_role rename value 'manager' to 'standard_user';
  end if;
end $$;

create type public.task_gender as enum ('men', 'women', 'unisex');
create type public.task_status as enum ('not_started', 'in_progress', 'completed', 'overdue');

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  task_name text not null,
  season_id uuid not null references public.seasons (id),
  brand_id uuid not null references public.brands (id),
  gender public.task_gender not null,
  due_date date not null,
  assignee_id uuid references public.profiles (id) on delete set null,
  status public.task_status not null default 'not_started',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index tasks_season_id_idx on public.tasks (season_id);
create index tasks_brand_id_idx on public.tasks (brand_id);
create index tasks_assignee_id_idx on public.tasks (assignee_id);
create index tasks_status_idx on public.tasks (status);
create index tasks_due_date_idx on public.tasks (due_date);

create trigger tasks_set_updated_at
  before update on public.tasks
  for each row
  execute function public.set_updated_at();

alter table public.tasks enable row level security;

-- Every signed-in user reads tasks (grid, calendar, Gantt, dashboards) — matches task.view
-- being granted to every role in lib/permissions.ts.
create policy tasks_select_authenticated
  on public.tasks
  for select
  to authenticated
  using (true);

-- Standard users create/edit tasks (task.create/task.update); viewers cannot. Matches the
-- STANDARD_USER_ALLOWED set in lib/permissions.ts, not the simpler admin-only pattern used
-- for seasons/brands — tasks have a genuinely broader write matrix.
create policy tasks_insert_standard_or_admin
  on public.tasks
  for insert
  to authenticated
  with check (public.current_user_role() in ('standard_user', 'admin'));

create policy tasks_update_standard_or_admin
  on public.tasks
  for update
  to authenticated
  using (public.current_user_role() in ('standard_user', 'admin'))
  with check (public.current_user_role() in ('standard_user', 'admin'));

-- Delete stays admin-only (task.delete is not in STANDARD_USER_ALLOWED).
create policy tasks_delete_admin
  on public.tasks
  for delete
  to authenticated
  using (public.is_admin());
