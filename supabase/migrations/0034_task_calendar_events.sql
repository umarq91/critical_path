-- Calendar Sync now pushes EVERY task on the platform to EVERY syncing user's own calendar (client
-- request), not just the syncing user's My Tasks. tasks.google_event_id/google_calendar_owner_id
-- can only hold one event per task (first-claim-wins), so a department's task reached whichever
-- member synced first and nobody else. This is the per-(task, profile) join table things-to-know
-- sketched for exactly this case, the same shape holiday_calendar_events (0028) took.
--
-- content_hash is what the event was last pushed with (title + description + date). Sync skips
-- a task whose hash is unchanged, so a repeat sync of ~800 tasks is a handful of Google calls,
-- not ~800. null means "push it next time".
create table public.task_calendar_events (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  google_event_id text not null,
  content_hash text,
  synced_at timestamptz not null default now(),
  unique (task_id, profile_id)
);

create index task_calendar_events_profile_id_idx on public.task_calendar_events (profile_id);

alter table public.task_calendar_events enable row level security;

-- Reading every user's links is needed by whoever edits or deletes a task: that action updates
-- or removes the task's event on every calendar that holds it, not only the editor's own.
create policy task_calendar_events_select_internal
  on public.task_calendar_events
  for select
  to authenticated
  using ((select public.is_active_user()) and not (select public.is_external_user()));

-- Sync writes only the caller's own links.
create policy task_calendar_events_insert_self_or_admin
  on public.task_calendar_events
  for insert
  to authenticated
  with check ((select public.is_active_user()) and (profile_id = auth.uid() or (select public.is_admin())));

-- Own links, or anyone who can edit tasks (the edit/delete fan-out above). Same role set as
-- tasks_update_standard_or_admin (0018).
create policy task_calendar_events_update_self_or_editor
  on public.task_calendar_events
  for update
  to authenticated
  using (
    (select public.is_active_user())
    and (profile_id = auth.uid() or (select public.current_user_role()) in ('standard_user', 'admin'))
  )
  with check (
    (select public.is_active_user())
    and (profile_id = auth.uid() or (select public.current_user_role()) in ('standard_user', 'admin'))
  );

create policy task_calendar_events_delete_self_or_editor
  on public.task_calendar_events
  for delete
  to authenticated
  using (
    (select public.is_active_user())
    and (profile_id = auth.uid() or (select public.current_user_role()) in ('standard_user', 'admin'))
  );

-- Carry over every event already on someone's calendar, so the first sync after this updates
-- it in place instead of creating a duplicate. content_hash null forces that one update.
insert into public.task_calendar_events (task_id, profile_id, google_event_id, synced_at)
select id, google_calendar_owner_id, google_event_id, coalesce(google_synced_at, now())
from public.tasks
where google_event_id is not null and google_calendar_owner_id is not null
on conflict (task_id, profile_id) do nothing;
