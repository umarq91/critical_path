-- Gender is hidden across the app for now (client decision, reversible) and optional when a task
-- is created, so a new task may have none. Existing rows keep their gender. The task_gender enum
-- stays as-is.

alter table public.tasks
  alter column gender drop not null;
