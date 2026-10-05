-- "Critical Task" flag: a yes/no marker so the team can pick out the tasks that matter most.
-- Not null with a false default, so every existing task reads as "not critical" without a
-- backfill, and an insert that doesn't mention it (CSV import, older clients) stays valid.
-- Covered by the existing tasks RLS policies (only roles that may update a task can set it);
-- 0029's viewer trigger only admits the calendar-sync columns, so a viewer can't flip it.

alter table public.tasks add column is_critical boolean not null default false;

-- Partial index: critical tasks are expected to be a small slice, and the grid's "Critical"
-- filter only ever asks for that slice.
create index tasks_is_critical_idx on public.tasks (id) where is_critical and deleted_at is null;
