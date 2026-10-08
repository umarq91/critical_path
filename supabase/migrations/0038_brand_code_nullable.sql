-- Brands no longer carry a code in the app (client decision, same as Season Code): the form and
-- export dropped it, and createBrand writes nothing, so new rows are null. Existing rows keep
-- their codes. The UNIQUE constraint stays — Postgres treats nulls as distinct, so it still
-- guards the codes that exist (the integration API's brand_code filter matches on them).

alter table public.brands
  alter column brand_code drop not null;
