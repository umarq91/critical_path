-- Adds a priority field to tasks — high/med/low, matching the bg-prio-{high,med,low} design
-- tokens already reserved in globals.css (added ahead of this feature landing) and the
-- Priority slot already stubbed (hardcoded "Not set") in task-detail-drawer.tsx.
--
-- Written idempotently (if not exists / guarded DO blocks), consistent with 0013, so it's
-- safe to paste into the SQL Editor and rerun.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'task_priority') then
    create type public.task_priority as enum ('high', 'med', 'low');
  end if;
end $$;

alter table public.tasks add column if not exists priority public.task_priority not null default 'med';

create index if not exists tasks_priority_idx on public.tasks (priority);
