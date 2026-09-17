-- Client decision: task_gender's two real values are now "Guys"/"Girls" instead of "Men"/
-- "Women" — cosmetic to the data (a plain rename, not a new value), so no rows need touching.
-- ALTER TYPE ... RENAME VALUE keeps every existing row's data intact: a task that was 'men' is
-- 'guys' after this runs, same row, same oid, nothing to backfill.
--
-- 'unisex' is deliberately left alone. The client asked for only two values going forward and
-- said not to worry about existing data (every seeded historical task defaulted to 'unisex' —
-- see supabase/seed-tasks.sql and things-to-know.md's Tasks section, the source export never
-- carried a gender column at all). Postgres has no ALTER TYPE ... DROP VALUE, and rewriting
-- those rows to force a real choice is exactly the "don't care about existing data" work this
-- decision explicitly opted out of. The app layer (taskGenderValues/TASK_GENDER_CONFIG) simply
-- stops offering 'unisex' anywhere; it stays a legal, retired value at the database layer for
-- whatever already has it.
alter type public.task_gender rename value 'men' to 'guys';
alter type public.task_gender rename value 'women' to 'girls';
