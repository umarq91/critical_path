-- Dev/test seed data for the tasks table — NOT a migration, don't number/apply this like
-- one. Run it manually via the Supabase SQL editor when you want sample rows to test the
-- /tasks page (pagination, filters, sorting, inline edit) against real data.
--
-- brand_id values are the real UUIDs from this project's brands table (fetched via
-- `select id, brand_code, brand_name, season_id from public.brands order by brand_name;`).
-- season_id on each task matches that brand's own season_id, keeping the seed internally
-- consistent even though the two columns are independent in the schema.
--
-- assignee_id is left NULL for every row (no real profile UUIDs to reference here without
-- guessing — a wrong FK value would fail the whole insert). Backfill it yourself, e.g.:
--   update public.tasks set assignee_id = '<your-profile-id>' where assignee_id is null;

insert into public.tasks (task_name, season_id, brand_id, gender, due_date, status, notes)
values
  ('Creative Direction & Range Formation', 'feceef7e-7e12-4e1e-9bdd-c7694c7c273b', '0f7bf775-89dc-48be-9b7b-db6c3e76572b', 'men',    '2025-09-15', 'in_progress', 'Initial creative direction workshop with design team'),
  ('External Showing with Protos',         'feceef7e-7e12-4e1e-9bdd-c7694c7c273b', '0f7bf775-89dc-48be-9b7b-db6c3e76572b', 'women',  '2025-09-18', 'not_started', null),
  ('Design Brief Review',                  '299c8a83-e511-451f-bced-0d75c0b9832e', '731a43a4-a9f3-4b87-9473-d55d6c6307e5', 'unisex', '2025-08-20', 'overdue',     'Waiting on sign-off from brand manager'),
  ('Range Development Kickoff',            '50fc89ff-e022-4278-9c77-3216c4be4025', '0407e93b-618c-4535-984f-66da68d6eb5c', 'men',    '2025-10-02', 'not_started', null),
  ('Fabric Sourcing Approval',             'c0908ddf-9e6e-4e2a-850e-abb909ec2ed9', 'ed6dcdc3-91c8-496d-8e88-2f8fb930f322', 'women',  '2025-09-05', 'completed',   'Approved swatches from mill, moving to bulk order'),
  ('Sample Fitting Session',               'd9a685d1-eb57-48df-94de-5d160b6a6716', 'c5a1cce4-e51d-457d-a2fb-cd2d62e1dd3f', 'men',    '2025-09-22', 'in_progress', 'Second fit round scheduled with pattern maker'),
  ('Cost Sheet Finalisation',              'a7fb5a54-c042-4110-87f0-ab66e44e51fb', '32ea2a82-de50-468d-908a-1b1ffb032610', 'unisex', '2025-08-28', 'overdue',     null),
  ('Buy Sign-off Meeting',                 '84055628-d149-4067-a87c-ee7cbd409999', 'a9762f2c-26bd-4c33-ab5d-1a5ca1a3424d', 'women',  '2025-09-30', 'not_started', 'Needs finance approval before proceeding'),
  ('Photography & Content Shoot',          'a653c9c8-6395-4506-a0c7-99d13f5d935c', '6138c7e1-fb49-4976-b93d-831a3763ae78', 'men',    '2025-10-10', 'not_started', null),
  ('Line Sheet Distribution',              '454791df-d7d3-4579-a6f8-d7b509a8d16a', '2e779247-becc-4e00-82b1-05c4b16027d3', 'unisex', '2025-09-12', 'completed',   'Sent to all wholesale accounts'),
  ('Creative Direction & Range Formation', 'feceef7e-7e12-4e1e-9bdd-c7694c7c273b', '4dc4e746-2bcb-4799-bc38-50d91eaa0f93', 'women',  '2025-09-15', 'in_progress', null),
  ('External Showing with Protos',         '2de52744-b32d-4cee-bf9c-d1e55b1c0048', 'e7bf680e-6373-460a-ab78-5dc0c3ef9e3b', 'men',    '2025-08-25', 'overdue',     'Rescheduled twice, escalate to brand manager'),
  ('Range Refinement Review',              '0e8d9177-728b-4de0-a1a3-6ffbf530b920', 'c09ab873-874f-440d-87d0-49a305c2768d', 'women',  '2025-10-05', 'not_started', null),
  ('Trim & Packaging Approval',            'feceef7e-7e12-4e1e-9bdd-c7694c7c273b', '00317846-bf2a-4639-a03c-50f140b07d76', 'men',    '2025-09-08', 'completed',   'All trims signed off by QA'),
  ('Design Brief Review',                  'b3d760b2-e5dd-47f3-b469-0e789fcc09a4', '13204a6e-8b87-4f08-8eb6-cff0810e8696', 'unisex', '2025-11-01', 'not_started', null),
  ('Range Development Kickoff',            '57ce6c74-4b41-4448-9676-a328ec5a36c8', '074fab4f-8d2e-4a23-b014-f9c012cdba07', 'women',  '2025-09-20', 'in_progress', 'Moodboard shared with team for feedback'),
  ('Fabric Sourcing Approval',             'c0908ddf-9e6e-4e2a-850e-abb909ec2ed9', '44a51077-db2f-459d-8539-ef8849aae7ff', 'men',    '2025-08-15', 'overdue',     null),
  ('Sample Fitting Session',               '454791df-d7d3-4579-a6f8-d7b509a8d16a', 'd40eef6e-60cd-4060-98b3-c27b51dca1ed', 'unisex', '2025-09-27', 'not_started', null),
  ('Buy Sign-off Meeting',                 'acbc2e73-b06e-4e20-b2a2-223f558f6a92', '3bcc9c41-b386-4149-be07-c6a8a78b68fc', 'women',  '2025-10-15', 'not_started', 'Holiday range — tight timeline, flag risk if delayed'),
  ('Photography & Content Shoot',          '2de52744-b32d-4cee-bf9c-d1e55b1c0048', 'f21fda49-d54e-4450-a29d-607a6c277504', 'men',    '2025-09-11', 'completed',   null),
  ('Line Sheet Distribution',              'c746c932-7391-4900-a235-edbe609e83b2', '91af8042-4a26-4bdc-8c46-c4f510320123', 'unisex', '2025-11-20', 'not_started', null),
  ('Creative Direction & Range Formation', '299c8a83-e511-451f-bced-0d75c0b9832e', '731a43a4-a9f3-4b87-9473-d55d6c6307e5', 'women',  '2025-09-15', 'in_progress', null),
  ('External Showing with Protos',         '50fc89ff-e022-4278-9c77-3216c4be4025', '0407e93b-618c-4535-984f-66da68d6eb5c', 'men',    '2025-08-22', 'overdue',     'Protos held at customs, expediting'),
  ('Range Refinement Review',              'd9a685d1-eb57-48df-94de-5d160b6a6716', 'c5a1cce4-e51d-457d-a2fb-cd2d62e1dd3f', 'unisex', '2025-09-29', 'not_started', null),
  ('Cost Sheet Finalisation',              '84055628-d149-4067-a87c-ee7cbd409999', 'a9762f2c-26bd-4c33-ab5d-1a5ca1a3424d', 'women',  '2025-09-06', 'completed',   'Signed off, margin target met'),
  ('Trim & Packaging Approval',            'a653c9c8-6395-4506-a0c7-99d13f5d935c', '6138c7e1-fb49-4976-b93d-831a3763ae78', 'men',    '2025-10-08', 'not_started', null),
  ('Design Brief Review',                  '454791df-d7d3-4579-a6f8-d7b509a8d16a', '2e779247-becc-4e00-82b1-05c4b16027d3', 'women',  '2025-08-18', 'overdue',     null),
  ('Range Development Kickoff',            '0e8d9177-728b-4de0-a1a3-6ffbf530b920', 'c09ab873-874f-440d-87d0-49a305c2768d', 'unisex', '2025-09-24', 'in_progress', 'Concept approved, moving to development'),
  ('Sample Fitting Session',               'c746c932-7391-4900-a235-edbe609e83b2', '91af8042-4a26-4bdc-8c46-c4f510320123', 'men',    '2025-11-05', 'not_started', null);
