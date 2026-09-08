-- Audit log — append-only record of key user actions, and the table behind Management → Logs.
--
-- Scope of this migration: tasks (create / update / delete / owner + people-involved changes).
-- The table itself is entity-agnostic on purpose (`entity_type` is text, not an enum) so users,
-- departments, brands etc. can start writing to it without a schema change — the set of actions
-- grows with the app, and an enum would mean one migration per new verb.
--
-- Why this exists at all when `tasks` already has created_by / last_edited_by / deleted_by:
-- those columns hold the LATEST actor only. "Who changed the due date on 12 Aug, and what was
-- it before" is not answerable from them, and an owner change leaves no trace on `tasks` at all
-- (it's a task_participants write). This table is the history; those columns stay as they are.
--
-- Append-only by policy: there is an insert policy and a select policy, and deliberately NO
-- update or delete policy. Nothing holding the anon/authenticated role can rewrite history —
-- only the service-role client (or a DB admin) can, which is what makes the log worth reading.
--
-- Written idempotently (if not exists / guarded DO blocks) so it's safe to paste into the SQL
-- Editor and run again, same as 0015_task_participants.sql.

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  -- `on delete set null`, not cascade: deleting a person must not erase what they did. The
  -- denormalised actor_email below is what keeps the row readable once the profile is gone.
  actor_id uuid references public.profiles (id) on delete set null,
  actor_email text,
  action text not null,
  entity_type text not null,
  -- No FK: the row it points at is routinely soft-deleted, and a hard delete of the entity
  -- must not take its history with it. Resolution is by label, not by join.
  entity_id uuid,
  entity_label text,
  -- Shape depends on `action` — see src/types/audit.ts. Field-level diffs for updates,
  -- added/removed party names for participant changes.
  changes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- The list is always ordered newest-first and is the only access pattern that isn't filtered,
-- so created_at leads. The rest back the three filters the Logs page offers.
create index if not exists audit_log_created_at_idx on public.audit_log (created_at desc);
create index if not exists audit_log_actor_id_idx on public.audit_log (actor_id);
create index if not exists audit_log_action_idx on public.audit_log (action);
create index if not exists audit_log_entity_idx on public.audit_log (entity_type, entity_id);

alter table public.audit_log enable row level security;

do $$
begin
  -- Reading the log is admin-only, mirroring `admin.view_audit_log` in lib/permissions.ts.
  -- It contains every task title and every actor's email across the whole organisation, so
  -- the usual `using (true)` select policy would hand an external user the lot.
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'audit_log' and policyname = 'audit_log_select_admin'
  ) then
    create policy audit_log_select_admin
      on public.audit_log for select to authenticated
      using ((select public.is_admin()));
  end if;

  -- Anyone whose action is auditable must be able to write their own entry — a standard_user
  -- creating a task writes the `task.create` row through their own client, not a privileged
  -- one. Pinned to their own id so a row can't be attributed to someone else.
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'audit_log' and policyname = 'audit_log_insert_own'
  ) then
    create policy audit_log_insert_own
      on public.audit_log for insert to authenticated
      with check ((select public.is_active_user()) and actor_id = (select auth.uid()));
  end if;
end $$;

-- Backfill from the tracking columns on `tasks`, so the Logs page opens with the history that
-- already exists rather than empty. Each block is guarded by a not-exists on the same
-- (entity_id, action) pair, so re-running this file adds nothing.
--
-- The update backfill carries no field-level detail — `tasks` only records that a row was last
-- edited, by whom and when — so it's marked `backfilled` and the UI says so rather than
-- rendering an empty diff.
insert into public.audit_log (actor_id, actor_email, action, entity_type, entity_id, entity_label, changes, created_at)
select t.created_by, p.email, 'task.create', 'task', t.id, t.task_name,
       jsonb_build_object('backfilled', true), t.created_at
from public.tasks t
left join public.profiles p on p.id = t.created_by
where t.created_by is not null
  and not exists (
    select 1 from public.audit_log a where a.entity_id = t.id and a.action = 'task.create'
  );

insert into public.audit_log (actor_id, actor_email, action, entity_type, entity_id, entity_label, changes, created_at)
select t.last_edited_by, p.email, 'task.update', 'task', t.id, t.task_name,
       jsonb_build_object('backfilled', true), t.updated_at
from public.tasks t
left join public.profiles p on p.id = t.last_edited_by
where t.last_edited_by is not null
  and t.updated_at > t.created_at + interval '1 second'
  and not exists (
    select 1 from public.audit_log a where a.entity_id = t.id and a.action = 'task.update'
  );

insert into public.audit_log (actor_id, actor_email, action, entity_type, entity_id, entity_label, changes, created_at)
select t.deleted_by, p.email, 'task.delete', 'task', t.id, t.task_name,
       jsonb_build_object('backfilled', true), t.deleted_at
from public.tasks t
left join public.profiles p on p.id = t.deleted_by
where t.deleted_at is not null
  and t.deleted_by is not null
  and not exists (
    select 1 from public.audit_log a where a.entity_id = t.id and a.action = 'task.delete'
  );
