-- Client-supplied historical data has tasks with no known due date (see things-to-know.md's
-- Tasks section). due_date must accept null so those rows can be imported/entered instead of
-- being rejected or given a fabricated date.
alter table tasks alter column due_date drop not null;
