-- Email sign-in code for external (email + password) accounts.
--
-- After a correct password, an external user is emailed a 6-digit code and gets no data until
-- they enter it. Every sign-in needs a new code, so verification is keyed by the Supabase
-- session (the `session_id` claim every access token carries), not by the user.
--
-- Why this lives in RLS and not just in the app: the project URL and anon key are public, so
-- anyone holding the password can get a token from Supabase directly and skip our code screen.
-- Folding the check into is_active_user() — which 0018 already put on every task, participant,
-- people and profile policy — means that token reads nothing.

create table public.session_verifications (
  -- Cascades from auth.sessions: signing out (or the session expiring) deletes the row, so the
  -- next sign-in starts unverified with no cleanup job.
  session_id uuid primary key references auth.sessions (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- HMAC of the current code, never the code itself. Null once verified.
  code_hash text,
  code_sent_at timestamptz,
  code_expires_at timestamptz,
  failed_attempts integer not null default 0,
  verified_at timestamptz
);

-- RLS on with no policies: service role only. A user must never be able to write their own
-- verified_at, which is the entire point of the table.
alter table public.session_verifications enable row level security;

create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.status = 'active'
      and (
        p.role <> 'external'
        or exists (
          select 1 from public.session_verifications v
          where v.session_id = nullif(auth.jwt() ->> 'session_id', '')::uuid
            and v.user_id = p.id
            and v.verified_at is not null
        )
      )
  );
$$;

-- ---------------------------------------------------------------------------
-- Tables whose read policy was `using (true)` or own-row only, and so didn't pass through
-- is_active_user() yet. An unverified external session must read nothing but its own profile
-- row (profiles_select_scoped's unconditional self-read leg, left as is — (app)/layout.tsx
-- needs it to route the user to the code screen).
-- ---------------------------------------------------------------------------

drop policy if exists seasons_select_authenticated on public.seasons;
create policy seasons_select_authenticated
  on public.seasons for select to authenticated
  using ((select public.is_active_user()));

drop policy if exists brands_select_authenticated on public.brands;
create policy brands_select_authenticated
  on public.brands for select to authenticated
  using ((select public.is_active_user()));

drop policy if exists brand_seasons_select_authenticated on public.brand_seasons;
create policy brand_seasons_select_authenticated
  on public.brand_seasons for select to authenticated
  using ((select public.is_active_user()));

drop policy if exists key_stages_select_authenticated on public.key_stages;
create policy key_stages_select_authenticated
  on public.key_stages for select to authenticated
  using ((select public.is_active_user()));

drop policy if exists departments_select_authenticated on public.departments;
create policy departments_select_authenticated
  on public.departments for select to authenticated
  using ((select public.is_active_user()));

drop policy if exists public_holidays_select_authenticated on public.public_holidays;
create policy public_holidays_select_authenticated
  on public.public_holidays for select to authenticated
  using ((select public.is_active_user()));

drop policy if exists saved_views_own_row on public.saved_views;
create policy saved_views_own_row
  on public.saved_views for all to authenticated
  using ((select public.is_active_user()) and (select auth.uid()) = profile_id)
  with check ((select public.is_active_user()) and (select auth.uid()) = profile_id);

drop policy if exists reminder_rules_own_row on public.reminder_rules;
create policy reminder_rules_own_row
  on public.reminder_rules for all to authenticated
  using ((select public.is_active_user()) and (select auth.uid()) = profile_id)
  with check ((select public.is_active_user()) and (select auth.uid()) = profile_id);

drop policy if exists reminder_rule_tasks_own_rule on public.reminder_rule_tasks;
create policy reminder_rule_tasks_own_rule
  on public.reminder_rule_tasks for all to authenticated
  using (
    (select public.is_active_user())
    and exists (
      select 1 from public.reminder_rules r
      where r.id = reminder_rule_tasks.rule_id and r.profile_id = (select auth.uid())
    )
  )
  with check (
    (select public.is_active_user())
    and exists (
      select 1 from public.reminder_rules r
      where r.id = reminder_rule_tasks.rule_id and r.profile_id = (select auth.uid())
    )
  );

drop policy if exists holiday_calendar_events_self_or_admin on public.holiday_calendar_events;
create policy holiday_calendar_events_self_or_admin
  on public.holiday_calendar_events for all to authenticated
  using ((select public.is_active_user()) and (profile_id = (select auth.uid()) or (select public.is_admin())))
  with check ((select public.is_active_user()) and (profile_id = (select auth.uid()) or (select public.is_admin())));

drop policy if exists profiles_update_self_or_admin on public.profiles;
create policy profiles_update_self_or_admin
  on public.profiles for update to authenticated
  using ((select public.is_active_user()) and (auth.uid() = id or (select public.is_admin())))
  with check ((select public.is_active_user()) and (auth.uid() = id or (select public.is_admin())));
