-- "Smart search" for the People Involved picker (tasks/people-search-dropdown.tsx). Plain
-- ILIKE substring matching (0010-era data/profiles.ts) required the search term to appear
-- verbatim and in the same word order as the stored name — a poor match for how people
-- actually type a colleague's name from memory (wrong order, just a first name, minor
-- misspellings). This adds:
--   1. pg_trgm, for typo-tolerant fuzzy matching via similarity().
--   2. search_profiles(), a Postgres function doing word-by-word + trigram matching, ranked
--      by relevance. Called via .rpc() from data/profiles.ts — PostgREST's query builder
--      can't express similarity-ranked ordering directly, only a SQL function can.

create extension if not exists pg_trgm;

create index profiles_full_name_trgm_idx on public.profiles using gin (full_name gin_trgm_ops);
create index profiles_email_trgm_idx on public.profiles using gin (email gin_trgm_ops);

create or replace function public.search_profiles(
  search text default null,
  exclude_ids uuid[] default '{}',
  limit_count int default 20,
  offset_count int default 0
)
returns table (
  id uuid,
  full_name text,
  email text,
  avatar_url text,
  department_name text
)
language sql
stable
security invoker
set search_path = public
as $$
  with terms as (
    -- Split the search into words so "smith john" or just "john" both match "John Smith" —
    -- order-independent, and a single word is enough to start narrowing results.
    select array_remove(string_to_array(trim(coalesce(search, '')), ' '), '') as words
  )
  select p.id, p.full_name, p.email, p.avatar_url, d.name as department_name
  from public.profiles p
  left join public.departments d on d.id = p.department_id
  cross join terms
  where p.status = 'active'
    and not (p.id = any (coalesce(exclude_ids, '{}'::uuid[])))
    and (
      search is null or trim(search) = ''
      or (
        -- Every word must fuzzy-match the name or email somewhere — AND across words (so a
        -- two-word search narrows, doesn't just union), OR across the two fields per word.
        select bool_and(
          p.full_name ilike '%' || word || '%'
          or p.email ilike '%' || word || '%'
          or similarity(coalesce(p.full_name, ''), word) > 0.25
          or similarity(p.email, word) > 0.25
        )
        from unnest(terms.words) as word
      )
    )
  order by
    case when search is null or trim(search) = '' then 0
      else greatest(similarity(coalesce(p.full_name, ''), search), similarity(p.email, search))
    end desc,
    p.full_name asc nulls last,
    p.email asc
  limit limit_count offset offset_count;
$$;

grant execute on function public.search_profiles(text, uuid[], int, int) to authenticated;
