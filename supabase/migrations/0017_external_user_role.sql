-- Adds the `external` role: a person who uses this platform but is NOT in the client's
-- Google Workspace. Created by an admin from Management → Users, signs in with email +
-- password, never through Google OAuth.
--
-- Deliberately its own migration containing NOTHING but the enum addition. Postgres will not
-- let a newly added enum label be *used* in the same transaction that adds it ("unsafe use of
-- new value of enum type"), and Supabase runs each migration file in a transaction — so
-- 0018_external_user_access.sql, which references 'external' in policies and functions, has
-- to be a separate file. Do not merge these two.
--
-- `if not exists` so a rerun against a database that already has the value is a no-op rather
-- than an error, matching the idempotent style of 0013/0015.

alter type public.user_role add value if not exists 'external';
