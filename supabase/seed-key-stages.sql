-- Seed data for the key_stages table — NOT a migration, don't number/apply this like one.
-- Run it manually via the Supabase SQL editor, AFTER seed-seasons.sql (that script deletes
-- every task, which is what releases the key_stage_id references).
--
-- The 13 distinct values of the KEY STAGE column in
-- `Critical Path - Data exported 24th August 2026.xlsx` (TASKS sheet). Names verbatim and
-- uppercase as the client writes them, so a CSV import of that export matches on exact string.
--
-- ⚠️ ORDER IS NOT PRESERVED BY THIS SEED. `key_stages` has no sort_order column
-- (0008_key_stages.sql) and data/key-stages.ts orders by `name`, so the Timeline/Gantt will
-- group these ALPHABETICALLY — CAMPAIGN, CONSOLIDATION, CREATIVE DIRECTION…, LAUNCH — which is
-- meaningless for a critical path. The insert order below is the real sequence, derived from
-- the earliest task start date per stage within a full season (Q3'26 and Q1'27 / H1'27 agree),
-- but insertion order is not retrievable. A sort_order column is needed before Timeline
-- grouping reads correctly.
--
-- RANGE REVIEW vs RANGE REFINEMENT occupy the same slot and never co-occur: quarterly seasons
-- use RANGE REFINEMENT, the monthly INJECTION seasons use RANGE REVIEW. Both sit between
-- RANGE DEVELOPMENT and RANGE RELEASE.
--
-- Re-runnable: `key_stages.name` has no unique constraint, so `on conflict` isn't available —
-- the not-exists guard is what makes a second run a no-op instead of a duplicate set.

delete from public.key_stages;

insert into public.key_stages (name, description)
select k.name, k.description
from (
  values
    ('PRE SEASON PREP',                      'Season setup and groundwork before creative work starts'),
    ('TREND TRIP',                           'Market and trend research travel informing the range direction'),
    ('CREATIVE DIRECTION & RANGE FORMATION', 'Design brief, investment review, and range architecture'),
    ('RANGE DEVELOPMENT',                    'CADs, tech packs, and vendor handover through to sampling'),
    ('RANGE REVIEW',                         'Range checkpoint on injection seasons — the RANGE REFINEMENT equivalent'),
    ('RANGE REFINEMENT',                     'Fit, costing, and range edits ahead of release'),
    ('RANGE RELEASE',                        'Final range sign-off and release to sales'),
    ('SALES TOOLS FORMATION',                'Linesheets, samples, and selling collateral'),
    ('SELL PERIOD',                          'Wholesale selling window and order collection'),
    ('CONSOLIDATION',                        'Order consolidation and buy finalisation'),
    ('CAMPAIGN',                             'Marketing campaign production and rollout'),
    ('SHIPPING',                             'Freight, logistics, and delivery into warehouse'),
    ('LAUNCH',                               'In-store and online launch')
) as k(name, description)
where not exists (
  select 1 from public.key_stages existing where existing.name = k.name
);
