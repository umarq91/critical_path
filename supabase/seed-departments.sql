-- Seed data for the departments table — NOT a migration, don't number/apply this like one.
-- Run it manually via the Supabase SQL editor.
--
-- Unlike seed-brands.sql / seed-seasons.sql this is NOT invented sample data: every row is a
-- real value from the client's "Lists" sheet in
-- `Critical Path - Data exported 24th August 2026.xlsx`, which is the source dropdown behind
-- the TASKS sheet's OWNER and PEOPLE INVOLVED columns. Names are kept verbatim (casing and
-- all — "Brand Managers" plural, "E-Commerce" hyphenated, "SLT" uppercase) so a future CSV
-- import of that sheet matches on exact string without a translation table.
--
-- Two entries from that dropdown are deliberately omitted: "Johan Persson" and
-- "Par Lundqvist" are individual people, not departments — the spreadsheet had one list and
-- no other place to put them. Here they belong in `profiles`, assigned to whichever
-- department they actually sit in. ("Par Lundqvist" appears as owner on 1 task and in people
-- involved on 26; "Johan Persson" is unused in the export entirely.)
--
-- Re-runnable: `departments.name` has no unique constraint (0009_departments.sql), so an
-- `on conflict` clause isn't available — the not-exists guard is what makes a second run a
-- no-op instead of a duplicate set.

insert into public.departments (name, description)
select d.name, d.description
from (
  values
    ('Brand Managers',      'Owns the critical path per brand — briefs, sign-offs, and range milestones'),
    ('Buying',              'Range planning and order placement'),
    ('Customer Service',    'Post-sale support and returns'),
    ('Design',              'Concept, CADs, and artwork through to design sign-off'),
    ('E-Commerce',          'Online channel — site merchandising and digital launch'),
    ('EU Team',             'Europe regional team'),
    ('Finance',             'Costing, margin, and payment approvals'),
    ('Marketing',           'Campaign, content, and go-to-market activity'),
    ('Operations Manager',  'Cross-functional operational coordination'),
    ('Planning',            'Demand and range planning, investment reviews'),
    ('Product Development', 'Tech packs, fit, and sampling through to vendor handover'),
    ('Production',          'Bulk manufacturing and production tracking'),
    ('Sales',               'Wholesale and account management'),
    ('Shipping',            'Freight, logistics, and delivery into warehouse'),
    ('SLT',                 'Senior leadership team — strategic sign-offs'),
    ('Supplier',            'External raw material and trim suppliers'),
    ('US Team',             'United States regional team'),
    ('Vendor',              'External manufacturing partners')
) as d(name, description)
where not exists (
  select 1 from public.departments existing where existing.name = d.name
);
