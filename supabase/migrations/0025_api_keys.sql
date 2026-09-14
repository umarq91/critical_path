-- API keys for the read-only integration API (/integration/v1/*, Databricks via Kong — see
-- docs/databricks-integration-api-spec.md and things-to-know.md's Integrations section).
--
-- The raw key is never stored — only a SHA-256 hash (key_hash) and a short, non-secret prefix
-- (key_prefix) for the admin UI to recognise a key by. Generated and hashed in
-- lib/integration-keys.ts; the raw value is shown to whoever created it exactly once, at
-- creation, the same way a GitHub/Stripe token is.
--
-- Revoked, never deleted — same idiom as deactivating a user or soft-deleting a task: a row's
-- history (who created it, who revoked it, when) stays around. There is deliberately no delete
-- policy below.

create table public.api_keys (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  -- First 12 chars of the raw key (e.g. "cpi_a1b2c3d4") — enough for an admin to recognise
  -- which key is which without the full secret ever touching the database.
  key_prefix text not null,
  key_hash text not null unique,
  status text not null default 'active' check (status in ('active', 'revoked')),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  revoked_by uuid references public.profiles (id) on delete set null,
  revoked_at timestamptz,
  -- Bumped best-effort by requireIntegrationApiKey() on every authenticated request — lets an
  -- admin see whether a key is actually in use before revoking it.
  last_used_at timestamptz
);

alter table public.api_keys enable row level security;

-- Admin-only in both directions, same policy shape as audit_log (0020): this table is at least
-- as sensitive — a leaked key is a standing read into every entity the integration API exposes,
-- not just a log of what already happened.
create policy api_keys_select_admin
  on public.api_keys
  for select
  to authenticated
  using ((select public.is_admin()));

create policy api_keys_insert_admin
  on public.api_keys
  for insert
  to authenticated
  with check ((select public.is_admin()));

-- Covers revoke (status/revoked_at/revoked_by) — there is no update policy split from insert
-- because both actions are equally admin-only and there is nothing else on this row a person
-- ever edits (name is set once, at creation).
create policy api_keys_update_admin
  on public.api_keys
  for update
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- No delete policy — see the comment at the top of this file.
