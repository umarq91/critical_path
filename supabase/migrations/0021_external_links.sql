-- External links — a flat, admin-curated list of resources the team needs to reach from the
-- platform (shared drives, reference sites, supplier portals). Title + description + url and
-- nothing else: no category, no sort_order, no owner. That is the confirmed scope, and the
-- absence of sort_order is why the list is ordered by title (see data/external-links.ts).
--
-- This is the table plan.md §4 sketched as `sales_toolkit_links` (label, url, sort_order,
-- category) for the Sales Toolkit page. That page was never built; if it lands later it should
-- read this table rather than introducing a second one.
--
-- Falls under the general admin.manage_lookups permission bucket (lib/permissions.ts), same as
-- seasons and key stages — no dedicated external_link.* row on the client's Role-Based Access
-- screen.

create table public.external_links (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  url text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create trigger external_links_set_updated_at
  before update on public.external_links
  for each row
  execute function public.set_updated_at();

alter table public.external_links enable row level security;

-- Read is for signed-in STAFF, not for everyone with a session: external users (0017/0018) are
-- outside the client's Workspace, and this is an internal resource list. Their role is excluded
-- here for the same reason lookups.view excludes it in lib/permissions.ts — the two must agree.
create policy external_links_select_internal
  on public.external_links
  for select
  to authenticated
  using (public.is_active_user() and not public.is_external_user());

create policy external_links_write_admin
  on public.external_links
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Soft-deleted rows are filtered in the data layer, so the index carries the predicate rather
-- than the query paying for it on every list.
create index external_links_title_idx on public.external_links (title) where deleted_at is null;
