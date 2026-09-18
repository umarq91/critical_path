-- Tracks which holidays have been pushed to which user's Google Calendar. A task can reuse its
-- own google_event_id/google_calendar_owner_id columns because a task has exactly one owner;
-- a holiday has none (it's a shared, admin-managed row), so a given holiday can be pushed to
-- MANY users' calendars independently — this join table is what a single-owner column can't
-- express. Same one-way, per-user-OAuth push as tasks (0011/0019), just keyed per (holiday,
-- profile) instead of per task.
create table public.holiday_calendar_events (
  id uuid primary key default gen_random_uuid(),
  holiday_id uuid not null references public.public_holidays (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  google_event_id text not null,
  synced_at timestamptz not null default now(),
  unique (holiday_id, profile_id)
);

alter table public.holiday_calendar_events enable row level security;

-- A user manages only their own sync links; an admin's own action (deleteHoliday/updateHoliday
-- cleaning up every affected user's event, not just their own) needs the broader is_admin() leg,
-- same "self or admin" shape as profiles_update_self_or_admin.
create policy holiday_calendar_events_self_or_admin
  on public.holiday_calendar_events
  for all
  to authenticated
  using (profile_id = auth.uid() or public.is_admin())
  with check (profile_id = auth.uid() or public.is_admin());

create index holiday_calendar_events_profile_id_idx on public.holiday_calendar_events (profile_id);
