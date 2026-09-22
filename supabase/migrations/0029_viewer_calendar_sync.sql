-- Lets `viewer` use the Calendar page's "Sync to Google" button, same as standard_user/admin
-- (client request: viewer should be able to sync their own calendar like everyone else).
--
-- lib/permissions.ts already grants viewer the `calendar.sync_google` action. That alone isn't
-- enough: pushTaskToGoogleCalendar (lib/google/task-calendar-sync.ts) deliberately writes the
-- resulting google_event_id/google_calendar_owner_id/google_synced_at back to the task through
-- the CALLER's own RLS-scoped client, not the admin client — "a push must not be able to update
-- a task the caller couldn't otherwise update" (see that file's comment). Under the existing
-- tasks_update_standard_or_admin policy (0018), viewer has no task-write path at all, so that
-- write would be silently rejected by RLS — worse than just "sync doesn't work", because the
-- Google Calendar event is created by upsertCalendarEvent() *before* this write is attempted, so
-- a rejected write leaves the task with no record it was ever synced and the next click creates
-- a duplicate event.
--
-- Rather than adding viewer to tasks_update_standard_or_admin (which would let a viewer update
-- ANY task column via a direct Postgrest call, contradicting lib/permissions.ts — viewer still
-- has no task.update grant there), this adds a second, narrower UPDATE policy for viewer alone,
-- paired with a trigger that rejects the write unless it only touches the three calendar-sync
-- columns. Postgres OR's multiple permissive policies for the same command together, so this
-- policy is purely additive — it doesn't touch tasks_update_standard_or_admin or what
-- standard_user/admin can do.

create policy tasks_update_viewer_calendar_sync
  on public.tasks
  for update
  to authenticated
  using ((select public.is_active_user()) and (select public.current_user_role()) = 'viewer')
  with check ((select public.is_active_user()) and (select public.current_user_role()) = 'viewer');

-- Column allowlist expressed as "strip these keys and diff what's left", not "list every other
-- column and compare each one" — the inverse would silently start allowing viewer writes to any
-- column added to `tasks` after this migration, since a hand-maintained blocklist can't know
-- about a column it predates. This fails closed instead: an unrecognised column is protected by
-- default, not exposed by omission. updated_at is excluded because tasks_set_updated_at (0006)
-- legitimately changes it on every update regardless of who's writing.
create or replace function public.restrict_viewer_task_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  allowed_keys text[] := array['google_event_id', 'google_calendar_owner_id', 'google_synced_at', 'updated_at'];
begin
  if (select public.current_user_role()) <> 'viewer' then
    return new;
  end if;

  if (to_jsonb(old) - allowed_keys) is distinct from (to_jsonb(new) - allowed_keys) then
    raise exception 'viewer may only update Google Calendar sync columns on tasks (%)', array_to_string(allowed_keys, ', ');
  end if;

  return new;
end;
$$;

create trigger tasks_restrict_viewer_columns
  before update on public.tasks
  for each row
  execute function public.restrict_viewer_task_columns();
