-- Tasks — tracking columns + timeline dates.
--   - created_by/last_edited_by/deleted_by: who did what, stamped by the Server Actions in
--     tasks/_actions.ts (createTask/updateTask/deleteTask), never client input.
--   - is_locked/locked_by/locked_at: columns only, per 0006's own note that locking is a
--     distinct feature — enforcement (who can flip it, what it blocks) is a deliberate
--     follow-up, not built here.
--   - start_date/end_date: the task's working timeline (end_date = expected finish date),
--     for the future Gantt/Timeline view — distinct from due_date, which stays the hard
--     deadline shown in the grid.

alter table public.tasks
  add column created_by uuid references public.profiles (id) on delete set null,
  add column last_edited_by uuid references public.profiles (id) on delete set null,
  add column deleted_by uuid references public.profiles (id) on delete set null,
  add column is_locked boolean not null default false,
  add column locked_by uuid references public.profiles (id) on delete set null,
  add column locked_at timestamptz,
  add column start_date date,
  add column end_date date,
  add constraint tasks_end_date_after_start_date check (end_date >= start_date);
