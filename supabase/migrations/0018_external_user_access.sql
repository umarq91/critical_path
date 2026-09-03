-- Access rules for the `external` role added in 0017, plus the account-status enforcement
-- the app never actually had.
--
-- Two problems this fixes:
--
-- 1. Every read policy in the schema so far is `using (true)` for any authenticated user.
--    That was safe while every account was a Threebyone Workspace account. It is not safe
--    once admins can create accounts for people outside the company: an external user would
--    otherwise read the entire organisation's task list and staff directory.
--
-- 2. `profiles.status` was write-only in practice — nothing anywhere checked it, so
--    "deactivating" a user changed a badge and nothing else. Deactivation now revokes data
--    access at the database level, not just in the UI.
--
-- Visibility rule for external users: they see a task only if they are a participant on it
-- (owner or involved), named directly or via their department. Same rule then cascades to
-- task participants and to which profiles they can resolve. Internal roles
-- (admin/standard_user/viewer) are unchanged — they still read everything.

-- ---------------------------------------------------------------------------
-- Helper predicates
-- ---------------------------------------------------------------------------

-- Same security-definer + pinned-search_path shape as current_user_role()/is_admin() in
-- 0001: these are called from inside RLS policies on the very tables they read, so they must
-- run as the function owner to avoid infinite policy recursion.

create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and status = 'active'
  );
$$;

create or replace function public.is_external_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_role() = 'external';
$$;

-- Is the caller a participant on this task — named directly, or via the department they
-- belong to? Mirrors the task_participant_profiles view's UNION (0015) as a per-row
-- predicate, because a policy needs a boolean, not a row set.
create or replace function public.task_involves_current_user(p_task_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.task_participants tp
    where tp.task_id = p_task_id
      and (
        tp.profile_id = auth.uid()
        or (
          tp.department_id is not null
          and tp.department_id = (select department_id from public.profiles where id = auth.uid())
        )
      )
  );
$$;

-- Does this profile appear on any task the caller is also on? Gates which people an external
-- user can resolve — enough to render the owners/People Involved on their own tasks, and
-- nothing beyond that. Deliberately not "everyone in my department": department membership
-- alone is not a working relationship, a shared task is.
create or replace function public.profile_shares_task_with_current_user(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.task_participants mine
    join public.task_participants theirs on theirs.task_id = mine.task_id
    where (
        mine.profile_id = auth.uid()
        or (
          mine.department_id is not null
          and mine.department_id = (select department_id from public.profiles where id = auth.uid())
        )
      )
      and (
        theirs.profile_id = p_profile_id
        or (
          theirs.department_id is not null
          and theirs.department_id = (select department_id from public.profiles where id = p_profile_id)
        )
      )
  );
$$;

-- Every parameterless predicate below is wrapped in a scalar subquery — `(select
-- public.is_active_user())` rather than a bare call. Postgres hoists that into an InitPlan
-- and evaluates it once per statement; called directly it is re-evaluated for every row
-- scanned, which on a table the size of `tasks` is the difference between one profile lookup
-- and thousands. task_involves_current_user(id) takes the row's own id and so genuinely must
-- run per row — it is deliberately NOT wrapped.

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

-- Self-read is unconditional and sits OUTSIDE the is_active_user() gate on purpose: a
-- deactivated user must still be able to load their own profile row, otherwise
-- (app)/layout.tsx can't tell "deactivated" from "not signed in" and bounces them to
-- /auth/sign-in, which proxy.ts immediately bounces back to /dashboard because the session
-- is still valid. Reading your own row is what breaks that loop and lets the app render an
-- explicit "account deactivated" screen.
drop policy if exists profiles_select_authenticated on public.profiles;

create policy profiles_select_scoped
  on public.profiles
  for select
  to authenticated
  using (
    id = auth.uid()
    or (
      (select public.is_active_user())
      and (
        not (select public.is_external_user())
        or public.profile_shares_task_with_current_user(id)
      )
    )
  );

-- ---------------------------------------------------------------------------
-- tasks
-- ---------------------------------------------------------------------------

drop policy if exists tasks_select_authenticated on public.tasks;

create policy tasks_select_scoped
  on public.tasks
  for select
  to authenticated
  using (
    (select public.is_active_user())
    and (
      not (select public.is_external_user())
      or public.task_involves_current_user(id)
    )
  );

-- Write policies keep the same role matrix (external is simply absent from the allow-list,
-- so it can't write) and additionally require an active account.
drop policy if exists tasks_insert_standard_or_admin on public.tasks;
drop policy if exists tasks_update_standard_or_admin on public.tasks;
drop policy if exists tasks_delete_admin on public.tasks;

create policy tasks_insert_standard_or_admin
  on public.tasks
  for insert
  to authenticated
  with check ((select public.is_active_user()) and (select public.current_user_role()) in ('standard_user', 'admin'));

create policy tasks_update_standard_or_admin
  on public.tasks
  for update
  to authenticated
  using ((select public.is_active_user()) and (select public.current_user_role()) in ('standard_user', 'admin'))
  with check ((select public.is_active_user()) and (select public.current_user_role()) in ('standard_user', 'admin'));

create policy tasks_delete_admin
  on public.tasks
  for delete
  to authenticated
  using ((select public.is_active_user()) and (select public.is_admin()));

-- ---------------------------------------------------------------------------
-- task_participants (+ the superseded task_people)
-- ---------------------------------------------------------------------------

-- Scoped to the same tasks the caller can see, so an external user can't enumerate who works
-- on tasks that are invisible to them. task_involves_current_user() is security definer, so
-- reading task_participants from inside task_participants' own policy doesn't recurse.
drop policy if exists task_participants_select_authenticated on public.task_participants;

create policy task_participants_select_scoped
  on public.task_participants
  for select
  to authenticated
  using (
    (select public.is_active_user())
    and (
      not (select public.is_external_user())
      or public.task_involves_current_user(task_id)
    )
  );

drop policy if exists task_participants_write_standard_or_admin on public.task_participants;

create policy task_participants_write_standard_or_admin
  on public.task_participants
  for all
  to authenticated
  using ((select public.is_active_user()) and (select public.current_user_role()) in ('standard_user', 'admin'))
  with check ((select public.is_active_user()) and (select public.current_user_role()) in ('standard_user', 'admin'));

-- task_people is superseded by task_participants (0015) but still present, and it still has
-- a `using (true)` read policy — an external user could read the full people-involved graph
-- through it otherwise. Closed here too rather than left as a hole until the drop migration.
drop policy if exists task_people_select_authenticated on public.task_people;

create policy task_people_select_scoped
  on public.task_people
  for select
  to authenticated
  using (
    (select public.is_active_user())
    and (
      not (select public.is_external_user())
      or public.task_involves_current_user(task_id)
    )
  );

drop policy if exists task_people_write_standard_or_admin on public.task_people;

create policy task_people_write_standard_or_admin
  on public.task_people
  for all
  to authenticated
  using ((select public.is_active_user()) and (select public.current_user_role()) in ('standard_user', 'admin'))
  with check ((select public.is_active_user()) and (select public.current_user_role()) in ('standard_user', 'admin'));

-- ---------------------------------------------------------------------------
-- Profile creation for admin-created external users
-- ---------------------------------------------------------------------------

-- Google sign-up is unchanged: no app_role in the metadata, so it still lands on 'viewer'
-- and auth/callback/route.ts resolves the real role from Google Groups straight after.
--
-- Admin-created external users go through supabase.auth.admin.createUser() with
-- user_metadata.app_role = 'external' (see management/users/_actions.ts), so the profile is
-- born with the right role instead of existing as a 'viewer' for a window.
--
-- ONLY 'external' is honoured, never 'admin'/'standard_user'/'viewer'. raw_user_meta_data is
-- caller-supplied on a self-service signUp, so treating it as authoritative for an arbitrary
-- role would be a privilege-escalation path. 'external' is the narrowest role in the matrix
-- (it sees strictly less than 'viewer'), so the worst a forged hint achieves is giving the
-- forger less access than the default.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role text := new.raw_user_meta_data ->> 'app_role';
begin
  insert into public.profiles (id, email, full_name, avatar_url, role)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url',
    case
      when requested_role = 'external' then 'external'::public.user_role
      else 'viewer'::public.user_role
    end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
