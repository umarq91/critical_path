-- Stopgap: there's no admin-bootstrap flow yet (first admin has to be set somehow before
-- is_admin() can ever be true), so the privileged-column guard on `profiles` currently
-- locks out even the Supabase project owner working directly in the SQL Editor / Table
-- Editor — those connect as the `postgres` role with no request JWT, so auth.uid() is
-- null and auth.role() is never 'service_role'. Exempt direct dashboard/DB connections
-- by role name. Revisit once a real admin-bootstrap path exists and tighten this back up.
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
    or new.department is distinct from old.department
    or new.google_group_id is distinct from old.google_group_id
  then
    raise exception 'Only an admin can change role, status, department, or google_group_id';
  end if;

  return new;
end;
$$;
