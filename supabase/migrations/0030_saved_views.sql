-- Saved filter/sort presets for the Tasks spreadsheet view — plan.md §4's original `saved_views`
-- sketch, built now that the Tasks grid's filter/sort state has settled into one shape
-- (data-table-search-params.ts's {filters, sortBy, sortDir}). A personal preference, same shape
-- as reminder_rules (0024): each row belongs to exactly one profile, no admin-write/everyone-read
-- split. `filters`/`sort_by`/`sort_dir` are stored verbatim in the same encoding the URL already
-- uses, so applying a saved view is just navigating to dataTableSearchParamsHref("/tasks", {...})
-- with no translation step.

create table public.saved_views (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  filters jsonb not null default '{}'::jsonb,
  sort_by text,
  sort_dir text,
  created_at timestamptz not null default now(),
  unique (profile_id, name)
);

create index saved_views_profile_id_idx on public.saved_views (profile_id);

alter table public.saved_views enable row level security;

-- A user manages only their own saved views — mirrors reminder_rules_own_row (0024).
create policy saved_views_own_row
  on public.saved_views
  for all
  to authenticated
  using ((select auth.uid()) = profile_id)
  with check ((select auth.uid()) = profile_id);
