-- The synced calendar's name changed from "Critical Path" to "Critical Path Calendar". The old
-- name is a calendar people use for their own things, so the app must stop writing to it. Every
-- cached calendar_id (0031) points at that old calendar, so clear them all: the next push finds
-- or creates "Critical Path Calendar" by name and caches that instead. Nothing on Google's side
-- is changed; events already in "Critical Path" stay there.

update public.google_oauth_tokens
  set calendar_id = null
  where calendar_id is not null;
