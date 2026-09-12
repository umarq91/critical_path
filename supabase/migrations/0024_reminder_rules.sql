-- Personal task reminders — a self-service notification preference, not an admin-managed
-- rule: each profile has at most one `reminder_rules` row (their own settings, configured on
-- /upcoming), naming which of their own tasks to be emailed about and how far ahead. There is
-- deliberately no admin-facing management screen and no per-task configuration — see
-- things-to-know.md's Reminders section for why this is simpler than the org-wide
-- `reminder_rules` concept `plan.md` originally sketched.

create table public.reminder_rules (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles (id) on delete cascade,
  -- Each entry is "notify N days before due_date" — presets (2/1/7) and a custom value are
  -- just integers in the same array, nothing structurally different between them.
  offset_days integer[] not null default '{}',
  notify_hour smallint not null default 9,
  is_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reminder_rules_notify_hour_range check (notify_hour between 0 and 23),
  constraint reminder_rules_offset_days_positive check (
    array_length(offset_days, 1) is null or 0 < all (offset_days)
  )
);

create trigger reminder_rules_set_updated_at
  before update on public.reminder_rules
  for each row
  execute function public.set_updated_at();

-- The specific tasks a rule applies to — a plain join, not a scope-type table: v1 only ever
-- targets individually-picked tasks (season/owner are just filters inside the picker UI, not a
-- second matching mechanism to keep in step with this one).
create table public.reminder_rule_tasks (
  id uuid primary key default gen_random_uuid(),
  rule_id uuid not null references public.reminder_rules (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (rule_id, task_id)
);

create index reminder_rule_tasks_rule_id_idx on public.reminder_rule_tasks (rule_id);
create index reminder_rule_tasks_task_id_idx on public.reminder_rule_tasks (task_id);

-- Dedupe + audit for the cron route: one row per (rule, task, offset) actually emailed, so a
-- run that overlaps a previous one (or a retried run) never sends the same reminder twice.
-- Service-role only — see the empty RLS policy set below — since only the cron route
-- (lib/supabase/admin.ts) ever touches this table.
create table public.notifications_log (
  id uuid primary key default gen_random_uuid(),
  rule_id uuid not null references public.reminder_rules (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete cascade,
  offset_days integer not null,
  sent_at timestamptz not null default now(),
  unique (rule_id, task_id, offset_days)
);

alter table public.reminder_rules enable row level security;
alter table public.reminder_rule_tasks enable row level security;
alter table public.notifications_log enable row level security;

-- A user manages only their own rule — this is a personal preference, not a lookup entity, so
-- there's no admin-write / everyone-reads split like seasons/brands/etc. Mirrors profiles'
-- own-row policy (0001: `auth.uid() = id`).
create policy reminder_rules_own_row
  on public.reminder_rules
  for all
  to authenticated
  using ((select auth.uid()) = profile_id)
  with check ((select auth.uid()) = profile_id);

create policy reminder_rule_tasks_own_rule
  on public.reminder_rule_tasks
  for all
  to authenticated
  using (
    exists (
      select 1 from public.reminder_rules r
      where r.id = reminder_rule_tasks.rule_id and r.profile_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.reminder_rules r
      where r.id = reminder_rule_tasks.rule_id and r.profile_id = (select auth.uid())
    )
  );

-- No policies on notifications_log: RLS is enabled with nothing granted to `authenticated`,
-- so only the service-role client (lib/supabase/admin.ts, used exclusively by the
-- /api/cron/task-reminders route) can read or write it.
