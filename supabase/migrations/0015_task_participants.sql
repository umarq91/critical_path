-- Task participants — replaces both `tasks.assignee_id` (single profile) and `task_people`
-- (task→profiles join) with one table where a participant is EITHER a profile OR a department,
-- and a task can have any number of each in either role.
--
-- Driven by the client's own data (`Critical Path - Data exported 24th August 2026.xlsx`):
--   - OWNER names a department, not a person, in 832 of 833 rows.
--   - OWNER is multi-valued in 283 of 833 (34%) — "Product Development, Vendor", "US Team,
--     EU Team". Confirmed as intentional joint ownership, so owner is NOT capped at one.
--   - Vendor (254 owner rows) and Supplier (16) are external and will never have logins, so
--     "a department with no users" is a normal state, not an edge case.
--   - The owning party also appears in PEOPLE INVOLVED in 795 of 833 rows (95%) — owner is the
--     accountable subset of the involved parties, not an orthogonal field. Hence one table
--     with a `role` column rather than two parallel join tables.
--
-- EXPAND phase only. `tasks.assignee_id` and `task_people` are backfilled from and then left
-- in place — dropping them here would break every read path (data/tasks.ts's TASK_SELECT,
-- columns.tsx, task-form.tsx, calendar/_actions.ts) the moment this runs. A follow-up
-- migration drops them once the app reads from this table instead.
--
-- Written idempotently (if not exists / guarded DO blocks) so it's safe to paste into the SQL
-- Editor and run again, same as 0013_brand_seasons.sql.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'task_participant_role') then
    create type public.task_participant_role as enum ('owner', 'involved');
  end if;
end $$;

create table if not exists public.task_participants (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  -- Exactly one of these is set — a polymorphic party reference kept as two real FKs rather
  -- than a (party_type, party_id) pair, so referential integrity and cascades still apply.
  profile_id uuid references public.profiles (id) on delete cascade,
  department_id uuid references public.departments (id) on delete cascade,
  role public.task_participant_role not null,
  created_at timestamptz not null default now(),
  constraint task_participants_exactly_one_party
    check (num_nonnulls(profile_id, department_id) = 1)
);

-- Two partial unique indexes, not one composite: Postgres treats NULLs as distinct in a
-- UNIQUE constraint, so `unique (task_id, profile_id, department_id, role)` would let
-- duplicates through on whichever column is null.
create unique index if not exists task_participants_profile_uniq
  on public.task_participants (task_id, profile_id, role)
  where profile_id is not null;

create unique index if not exists task_participants_department_uniq
  on public.task_participants (task_id, department_id, role)
  where department_id is not null;

create index if not exists task_participants_task_id_idx on public.task_participants (task_id);
create index if not exists task_participants_profile_id_idx on public.task_participants (profile_id);
create index if not exists task_participants_department_id_idx on public.task_participants (department_id);

alter table public.task_participants enable row level security;

-- Same matrix as tasks and task_people (0006/0010): anyone who can read a task can see who's
-- on it; only standard_user/admin can add/remove, matching task.assign in lib/permissions.ts.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'task_participants'
      and policyname = 'task_participants_select_authenticated'
  ) then
    create policy task_participants_select_authenticated
      on public.task_participants for select to authenticated using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'task_participants'
      and policyname = 'task_participants_write_standard_or_admin'
  ) then
    create policy task_participants_write_standard_or_admin
      on public.task_participants for all to authenticated
      using (public.current_user_role() in ('standard_user', 'admin'))
      with check (public.current_user_role() in ('standard_user', 'admin'));
  end if;
end $$;

-- Departments become addressable parties, not just a label on a profile. Vendor/Supplier are
-- external: no logins ever, so a reminder aimed at them has to reach contact_email or nobody.
alter table public.departments
  add column if not exists is_external boolean not null default false;

alter table public.departments
  add column if not exists contact_email text;

-- Backfill. Guarded on the source column/table still existing so a rerun after the follow-up
-- drop migration is a no-op rather than an error.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'tasks' and column_name = 'assignee_id'
  ) then
    insert into public.task_participants (task_id, profile_id, role)
    select id, assignee_id, 'owner' from public.tasks where assignee_id is not null
    on conflict do nothing;
  end if;

  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'task_people'
  ) then
    insert into public.task_participants (task_id, profile_id, role)
    select task_id, profile_id, 'involved' from public.task_people
    on conflict do nothing;
  end if;
end $$;

-- Flattens department membership down to individual profiles, so "tasks relevant to me" stays
-- one query instead of the three-hop (me -> my department -> tasks owned by it) that
-- data/tasks.ts would otherwise need — PostgREST can't express that subquery inline, which is
-- already why listTasks does a two-step for task_people today.
--
-- `union`, not `union all`: being named directly AND sitting in the owning department is the
-- common case (95% of rows in the client export), and that should be one row, not two.
-- `security_invoker = on` so the underlying tables' RLS still applies through the view.
create or replace view public.task_participant_profiles
with (security_invoker = on) as
  select
    tp.task_id,
    tp.role,
    tp.profile_id,
    'direct'::text as via
  from public.task_participants tp
  where tp.profile_id is not null
  union
  select
    tp.task_id,
    tp.role,
    p.id as profile_id,
    'department'::text as via
  from public.task_participants tp
  join public.profiles p on p.department_id = tp.department_id
  where tp.department_id is not null;

grant select on public.task_participant_profiles to authenticated;
