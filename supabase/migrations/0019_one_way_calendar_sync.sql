-- Google Calendar becomes ONE-WAY: platform task → Google Calendar, never the reverse.
--
-- 0011 built two pull paths, both removed here and in the application:
--   1. A task-linked pull-back — if a Google event's `updated` timestamp was newer than
--      tasks.google_synced_at, Google's title/date overwrote the task. That made Google
--      Calendar a second source of truth for org-wide data that anyone could edit from their
--      phone. The platform is the source of truth; nothing outside it may mutate a task.
--   2. external_calendar_events — a read-only cache of everything ELSE on a user's primary
--      calendar (meetings, personal events), rendered as chips in the platform calendar.
--      Dropped: the platform calendar shows platform tasks only.
--
-- tasks.google_event_id / google_calendar_owner_id are KEPT — still needed to find and update
-- or delete the one Google event that belongs to a task. google_synced_at is kept too, with
-- narrowed meaning (see the comment below): last successful push, never a conflict input.

drop table if exists public.external_calendar_events;

comment on column public.tasks.google_synced_at is
  'Last time this task was successfully PUSHED to Google Calendar. Sync is one-way — this is '
  'a record of the last outbound write, never an input to a Google-vs-platform conflict check.';

comment on column public.tasks.google_calendar_owner_id is
  'Profile whose Google Calendar holds google_event_id. A task maps to exactly one event, so '
  'the first eligible owner to sync claims it; later syncs by other owners skip a task already '
  'claimed by someone else rather than creating a duplicate event.';
