-- Per-user Google OAuth tokens for Calendar sync — replaces domain-wide-delegation
-- impersonation for this feature specifically (see calendar/_actions.ts's
-- syncGoogleCalendar and lib/google/calendar.ts). Domain-wide delegation only works for
-- accounts inside a real Google Workspace domain; a personal @gmail.com test account has
-- no admin console to grant it from, so it can never be impersonated by the service
-- account. Standard OAuth consent (this table) works with any Google account, dev or
-- production alike.
--
-- google-button.tsx requests the calendar.events scope + offline access at sign-in;
-- auth/callback/route.ts captures the resulting provider_token/provider_refresh_token here.

create table public.google_oauth_tokens (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles (id) on delete cascade,
  access_token text not null,
  refresh_token text,
  expires_at timestamptz not null,
  scope text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger google_oauth_tokens_set_updated_at
  before update on public.google_oauth_tokens
  for each row
  execute function public.set_updated_at();

alter table public.google_oauth_tokens enable row level security;

-- Deliberately NO policies — this table holds live API credentials, not display data, so
-- unlike every other per-user table (e.g. external_calendar_events), it isn't even
-- self-readable through RLS. RLS enabled + zero policies denies all access to both the
-- anon and authenticated roles; the only way in is lib/google/oauth-tokens.ts, which uses
-- the service-role client and scopes every query to a specific profile_id by hand.
