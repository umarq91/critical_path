-- Google Calendar sync moves from a user's primary calendar to a dedicated secondary calendar
-- named "Critical Path", created on first sync and reused after. This column caches the
-- resolved Google-side calendar id per profile so a sync run doesn't have to list-and-search
-- Google's calendarList on every single event push — see lib/google/calendar.ts's
-- resolveCalendarId(). Same zero-RLS, service-role-only shape as the rest of this table
-- (0012_google_oauth_tokens.sql's own note): a Google Calendar id is a credential-adjacent
-- implementation detail, not display data.

alter table public.google_oauth_tokens
  add column calendar_id text;
