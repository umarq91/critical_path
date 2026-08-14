-- Profiles + role-based access control.
-- Auth identity itself lives in Supabase's built-in auth.users (Google Workspace OAuth
-- only, enforced at the app layer). This migration adds the app-facing profile row per
-- user and the RLS rules that make "role" a trustworthy column.

create type public.user_role as enum ('admin', 'manager', 'viewer');

-- Reused by every future table with an updated_at column — write this trigger fn once.
create function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  avatar_url text,
  role public.user_role not null default 'viewer',
  department text,
  google_group_id text,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row
  execute function public.set_updated_at();

-- SECURITY DEFINER + pinned search_path: lets RLS policies below check "what role is the
-- caller" without an infinite loop (a normal `select role from profiles` inside a profiles
-- RLS policy would itself be subject to that same policy). This function reads the row
-- once as the function owner, bypassing RLS, and only ever returns a single enum value.
create function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_role() = 'admin';
$$;

-- Creates the profile row on first sign-in. Google OAuth metadata field names per
-- Supabase's Google provider: full_name and avatar_url.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- role/status/department/google_group_id are admin-managed, or system-managed by the
-- Google Group role sync (OAuth callback + nightly reconciliation cron), both of which
-- write via the service-role client precisely because the affected user is very often
-- *not* an admin yet — that's the whole point of resolving their role from Google Groups
-- on first sign-in. A user updating their own row via the normal per-user client must
-- still not be able to smuggle a role change through the same UPDATE that changes their
-- display name, so this only exempts the two trusted contexts: admin and service_role.
create function public.enforce_profile_column_permissions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() or auth.role() = 'service_role' then
    return new;
  end if;

  if new.role is distinct from old.role
    or new.status is distinct from old.status
    or new.department is distinct from old.department
    or new.google_group_id is distinct from old.google_group_id
  then
    raise exception 'Only an admin can change role, status, department, or google_group_id';
  end if;

  return new;
end;
$$;

create trigger profiles_guard_privileged_columns
  before update on public.profiles
  for each row
  execute function public.enforce_profile_column_permissions();

alter table public.profiles enable row level security;

-- Every signed-in user can see every profile — needed for owner/assignee pickers,
-- People-involved multi-selects, and the admin user list. No anonymous access.
create policy profiles_select_authenticated
  on public.profiles
  for select
  to authenticated
  using (true);

-- Row-level access is "yourself, or an admin"; column-level restriction is the trigger
-- above. Insert/delete have no policies (default deny) — rows are only ever created by
-- handle_new_user() and are never hard-deleted (deactivate via status instead).
create policy profiles_update_self_or_admin
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id or public.is_admin())
  with check (auth.uid() = id or public.is_admin());
