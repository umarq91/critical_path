-- Dev/test seed data for the brands table — NOT a migration, don't number/apply this like
-- one. Run it manually via the Supabase SQL editor when you want sample rows to test the
-- /brands page (pagination, filters, sorting, season link) against real data.
--
-- season_id values below are the real UUIDs from this project's seasons table (fetched via
-- `select id, season_code, season_name, status from public.seasons order by season_name;`),
-- not subqueries — swap them out if you re-seed seasons and get new ids.
--
-- Colors cycle through the same VIZ_COLORS palette the app's <ColorField> offers
-- (src/constants/chart-colors.ts), so these look like real choices, not placeholders.

insert into public.brands (brand_code, brand_name, description, status, color, season_id)
values
  ('BR-A', 'Aurora',      'Premium lifestyle apparel',      'active',   '#2b6ef6', 'feceef7e-7e12-4e1e-9bdd-c7694c7c273b'), -- Autumn/Winter 2026
  ('BR-B', 'Northline',   'Outdoor and performance wear',   'active',   '#1fbf75', 'feceef7e-7e12-4e1e-9bdd-c7694c7c273b'), -- Autumn/Winter 2026
  ('BR-C', 'Velora',      'Contemporary womenswear',        'active',   '#f5a524', '2de52744-b32d-4cee-bf9c-d1e55b1c0048'), -- Europe Autumn/Winter 2026
  ('BR-D', 'Marchwood',   'Menswear tailoring',             'active',   '#f0463c', '2de52744-b32d-4cee-bf9c-d1e55b1c0048'), -- Europe Autumn/Winter 2026
  ('BR-E', 'Sunfield',    'Resortwear and swim',            'active',   '#14b8a6', 'c0908ddf-9e6e-4e2a-850e-abb909ec2ed9'), -- Resort Q3 2026
  ('BR-F', 'Kindred',     'Kidswear',                       'active',   '#8b5cf6', '454791df-d7d3-4579-a6f8-d7b509a8d16a'), -- US Autumn/Winter 2026
  ('BR-G', 'Fjord',       'Cold-weather outerwear',         'active',   '#6366f1', 'd9a685d1-eb57-48df-94de-5d160b6a6716'), -- APAC Autumn/Winter 2026
  ('BR-H', 'Lumen',       'Athleisure',                     'active',   '#2b6ef6', 'feceef7e-7e12-4e1e-9bdd-c7694c7c273b'), -- Autumn/Winter 2026
  ('BR-I', 'Cascade',     'Footwear',                       'active',   '#1fbf75', '50fc89ff-e022-4278-9c77-3216c4be4025'), -- Spring/Summer 2027
  ('BR-J', 'Meridian',    'Accessories and bags',           'active',   '#f5a524', '0e8d9177-728b-4de0-a1a3-6ffbf530b920'), -- Europe Spring/Summer 2026
  ('BR-K', 'Hollowfield', 'Streetwear',                     'inactive', '#f0463c', '84055628-d149-4067-a87c-ee7cbd409999'), -- US Spring/Summer 2026
  ('BR-L', 'Birchgate',   'Denim',                          'active',   '#14b8a6', '299c8a83-e511-451f-bced-0d75c0b9832e'), -- APAC Spring/Summer 2026
  ('BR-M', 'Solace',      'Loungewear and sleepwear',       'active',   '#8b5cf6', '57ce6c74-4b41-4448-9676-a328ec5a36c8'), -- Resort Q4 2026
  ('BR-N', 'Ironwood',    'Workwear',                       'inactive', '#6366f1', 'a653c9c8-6395-4506-a0c7-99d13f5d935c'), -- Spring/Summer 2025
  ('BR-O', 'Palewind',    'Formalwear',                     'active',   '#2b6ef6', 'b3d760b2-e5dd-47f3-b469-0e789fcc09a4'), -- Pre-Launch Spring/Summer 2027
  ('BR-P', 'Driftmark',   'Swimwear',                       'active',   '#1fbf75', 'c0908ddf-9e6e-4e2a-850e-abb909ec2ed9'), -- Resort Q3 2026
  ('BR-Q', 'Underline',   'Underwear and basics',           'active',   '#f5a524', 'acbc2e73-b06e-4e20-b2a2-223f558f6a92'), -- Holiday 2026
  ('BR-R', 'Greywick',    'Unisex essentials',               'active',   '#f0463c', 'a7fb5a54-c042-4110-87f0-ab66e44e51fb'), -- Resort Q1 2026
  ('BR-S', 'Talonrun',    'Performance running gear',       'inactive', '#14b8a6', '454791df-d7d3-4579-a6f8-d7b509a8d16a'), -- US Autumn/Winter 2026
  ('BR-T', 'Wovenstone',  'Home and lifestyle accessories', 'active',   '#8b5cf6', 'c746c932-7391-4900-a235-edbe609e83b2'); -- Autumn/Winter 2027
