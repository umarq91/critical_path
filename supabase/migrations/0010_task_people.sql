-- People Involved — many-to-many between tasks and profiles, distinct from the single
-- "Owner / Assignee" (tasks.assignee_id). A join table, not an array column, so it reads the
-- same way every other relationship in this schema does (an embedded resource via
-- PostgREST's FK-based select) and so RLS can gate writes without touching `tasks` itself.

create table public.task_people (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (task_id, profile_id)
);

create index task_people_task_id_idx on public.task_people (task_id);
create index task_people_profile_id_idx on public.task_people (profile_id);

alter table public.task_people enable row level security;

-- Same read/write matrix as tasks itself (0006_tasks.sql): anyone who can read a task can see
-- who's involved; only standard_user/admin can add/remove — matches task.assign in
-- lib/permissions.ts, which is granted to standard_user (not viewer).
create policy task_people_select_authenticated
  on public.task_people
  for select
  to authenticated
  using (true);

create policy task_people_write_standard_or_admin
  on public.task_people
  for all
  to authenticated
  using (public.current_user_role() in ('standard_user', 'admin'))
  with check (public.current_user_role() in ('standard_user', 'admin'));
