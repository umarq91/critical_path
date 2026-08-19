-- Departments — a lightweight lookup entity, same shape as key_stages (0008): name +
-- description only, admin-managed, falls under the general admin.manage_lookups bucket.
-- Attaches to users only (profiles.department_id, replacing the old free-text
-- profiles.department column) — every user can optionally belong to a department. Tasks do
-- NOT get their own department_id: a task's department is read via its assignee's
-- profile.department_id, not stored redundantly on the task.
-- Deleting a department must not take its users down with it, so the FK is nullable with
-- on delete set null.

create table public.departments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create trigger departments_set_updated_at
  before update on public.departments
  for each row
  execute function public.set_updated_at();

alter table public.departments enable row level security;

create policy departments_select_authenticated
  on public.departments
  for select
  to authenticated
  using (true);

create policy departments_write_admin
  on public.departments
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Swap the old free-text department for a proper FK. No backfill needed — the column has
-- never been exposed in any UI (Users management is still a "Coming soon" stub), so there's
-- no existing free-text data to migrate.
alter table public.profiles
  drop column department;

alter table public.profiles
  add column department_id uuid references public.departments (id) on delete set null;

create index profiles_department_id_idx on public.profiles (department_id);

-- Re-point the privileged-column guard at department_id instead of department. Same function
-- as 0004_profiles_guard_allow_dashboard.sql otherwise, including the dashboard/SQL Editor
-- exemption — only the column name changes.
create or replace function public.enforce_profile_column_permissions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin()
    or auth.role() = 'service_role'
    or session_user in ('postgres', 'supabase_admin')
  then
    return new;
  end if;

  if new.role is distinct from old.role
    or new.status is distinct from old.status
    or new.department_id is distinct from old.department_id
    or new.google_group_id is distinct from old.google_group_id
  then
    raise exception 'Only an admin can change role, status, department_id, or google_group_id';
  end if;

  return new;
end;
$$;
