-- Two-way Google Calendar sync (manual, button-triggered — see calendar/_actions.ts's
-- syncGoogleCalendar). Two halves:
--   1. Task-linked events: a task pushed to Google Calendar gets its event id/owner/last-sync
--      timestamp stamped onto the task row itself — editing the date/title on either side and
--      re-running Sync reconciles both ways (newer `updated` timestamp wins).
--   2. Everything else on a user's calendar (meetings, personal events — anything not created
--      from a task) is cached read-only in external_calendar_events purely for display; it
--      never becomes a task since tasks require season/brand/gender/assignee this data
--      doesn't have.

alter table public.tasks
  add column google_event_id text,
  add column google_calendar_owner_id uuid references public.profiles (id) on delete set null,
  add column google_synced_at timestamptz;

-- Which Google account the event actually lives on — the assignee, creator, or an involved
-- person can each trigger a sync, but the event is only ever created on whichever one of
-- them ran it first, so the app needs to remember whose calendar to update/delete on later.
comment on column public.tasks.google_calendar_owner_id is
  'Profile whose Google Calendar holds google_event_id — the user who last synced this task.';

create table public.external_calendar_events (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  google_event_id text not null,
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  all_day boolean not null default false,
  last_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, google_event_id)
);

create index external_calendar_events_profile_range_idx
  on public.external_calendar_events (profile_id, starts_at);

create trigger external_calendar_events_set_updated_at
  before update on public.external_calendar_events
  for each row
  execute function public.set_updated_at();

alter table public.external_calendar_events enable row level security;

-- Personal cache, not shared org data like tasks — a user only ever sees/writes their own
-- synced events, so this is a single self-scoped policy rather than tasks' broader matrix.
create policy external_calendar_events_all_own
  on public.external_calendar_events
  for all
  to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());
