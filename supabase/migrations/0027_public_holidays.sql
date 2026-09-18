-- Public holidays — a lightweight lookup entity, admin managed entirely by hand (single add
-- form plus CSV bulk import; see docs/specs/0001-public-holidays/). No sync job, no source
-- column: every row is manual, so there's nothing to distinguish. Hard deleted, not soft
-- deleted, since nothing else in the schema references a holiday by foreign key.
--
-- `country` is plain text, not an enum. AU/CN/IN/TR are the 4 known today (offered as
-- suggestions in the form), but a 5th country later is a data entry, not a migration —
-- an enum would have made that a schema change every time.
create table public.public_holidays (
  id uuid primary key default gen_random_uuid(),
  country text not null,
  holiday_date date not null,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Allows more than one named holiday on the same day for the same country (confirmed:
  -- manual entry makes this plausible), while still rejecting an exact duplicate re-add.
  unique (country, holiday_date, name)
);

create trigger public_holidays_set_updated_at
  before update on public.public_holidays
  for each row
  execute function public.set_updated_at();

alter table public.public_holidays enable row level security;

-- Every signed in user sees holidays on the Calendar, including external users — a public
-- holiday date isn't organisation sensitive the way a brand or season list is.
create policy public_holidays_select_authenticated
  on public.public_holidays
  for select
  to authenticated
  using (true);

create policy public_holidays_write_admin
  on public.public_holidays
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create index public_holidays_date_idx on public.public_holidays (holiday_date);
create index public_holidays_country_idx on public.public_holidays (country);
