# Critical Path — Delivery Plan

Client: Threebyone (TBO) — `criticalpath.threebyone.com.au`
Stack: Next.js (App Router) · Supabase (Postgres + Auth + Storage + Edge Functions) · Nodemailer
Target: production-ready in 30–45 days, Priority 1 on the client's side

---

## 1. What's actually in scope

Three sources define this project, and they don't all carry equal weight:

1. **Original scope PDF** — the contract-level scope (hosting, auth, task management, calendar, dashboard, upcoming tasks + email, data integrations, security, code ownership, scalability).
2. **Client's follow-up email** — confirmed additions layered on top of #1: extra task columns, CSV bulk upload, templates, task locking, season colour-coding, auto-complete on due date, Gantt filter by Key Stage, public holiday sync, leave upload, mandatory overdue email reminders, Sales Toolkit page, Google Groups user sync.
3. **TBO Critical Path Integration API Spec (Databricks/Kong)** — originally **explicitly out of scope for this engagement** (the client's data engineer sent this so we understand what their side eventually expects; we shaped the Postgres schema sensibly — proper `updated_at`, soft deletes, stable IDs — so a future read API wouldn't be a rebuild, without committing to build it). **Reversed by later client direction**: the foundation (API-key issuance, `/management/integrations`, the `GET /health` proof-of-life endpoint) plus two real data endpoints (`GET /seasons`, `GET /brands`) are now built, with the remaining endpoints picked up incrementally. See §8 and `things-to-know.md`'s Integrations section. Full spec transcribed at `docs/databricks-integration-api-spec.md`.

The three reference screenshots of the client's current Airtable-style tool ("TBO Range Critical Path – DPSP Workflow") are the best source of truth for what a "task" actually looks like in practice: Status, Deliverable (task name), **Stage** (= Key Stage), Owner, People (multiple), Working Timeline (start → end), Due date, and a DPSP category tag (Demand / Product / Sales / Profit). This maps directly onto the "Key Stages" column the client asked for, and confirms tasks are grouped by **Season** at the top level with sub-grouping by category.

---

## 2. Assumptions (flag to client before/at kickoff)

These are reasonable defaults so the plan can proceed — confirm or correct in week 1, they're cheap to change now and expensive mid-build:

| Area | Assumption | Why it matters |
|---|---|---|
| Task locking / RBAC | **Confirmed** via the client's Role-Based Access screen — supersedes the earlier assumption below. 3 roles: **Administrator** (full access everywhere), **Standard User** (view/create/edit/assign tasks and events, comment, upload attachments; no delete, no bulk update, no lock/unlock, no user/lookup management, brands view-only), **Viewer** (view dashboard/tasks/calendar/brands only — no export, no writes anywhere). Locked tasks block **due date edits only** for Standard User; other fields remain editable. Full matrix lives in `src/lib/permissions.ts` (source of truth, not this table) — update both together if it changes. Superseded assumption, kept for history: originally "Viewer: read-only, **export only**" — the confirmed screen instead gives Viewer *no* export access and gives it to Standard User instead. | Changes permission model and RLS policies significantly if wrong. |
| Email reminders | Automatic, cron-driven (not manual trigger) — confirmed by client's email. Default cadence: 7 days before due, on due date, and every 3 days while overdue, fully configurable per the "set by user" requirement. | Confirms architecture (scheduled job, not on-demand). |
| Public holidays | Use a holiday API (candidates: Calendarific, Nager.Date) for AU, China, India, Türkiye. Admins can **also** manually add/override holidays (client didn't explicitly re-confirm this from our original question, but it's low-cost and avoids being stuck if the API misses a region-specific date). | Avoids a hard dependency on third-party API coverage. |
| Google Workspace | Domain-wide delegated service account with Admin SDK Directory API read access to Groups, used both for SSO gating and for role sync. Group → role mapping (e.g. `cp-admins@threebyone.com.au` → Admin) to be confirmed with client in week 1. | Needs Workspace admin cooperation to provision — a lead-time risk, flagged in §8. |
| Hosting/region | Vercel (Sydney/Australia edge region where available) + Supabase project provisioned in the `ap-southeast-2` (Sydney) region for data residency. | Original scope requires disclosed data residency; AU client, AU domain. |
| Team | Small team (2–3 devs) assumed for sequencing below, allowing frontend and backend/integration workstreams to run partly in parallel. If it's actually a solo build, double the elapsed time in §6. |
| Repo hosting | GitHub, private repo, transferred to a TBO-controlled org at project handover per the code ownership clause. |

---

## 3. Architecture

```
┌────────────────────────────────────────────────────────────┐
│                     Vercel (Next.js App Router)             │
│  - Server Components + Route Handlers (app/api/*)           │
│  - Google Workspace SSO via Supabase Auth (OAuth provider)  │
│  - Vercel Cron → triggers reminder + status-rollover jobs   │
└───────────────┬───────────────────────────────┬─────────────┘
                │                               │
                ▼                               ▼
┌───────────────────────────┐      ┌─────────────────────────────┐
│         Supabase           │      │   External services          │
│  - Postgres (RLS enforced) │      │   - Google Calendar API      │
│  - Auth (Google OAuth)     │      │   - Google Admin SDK (Groups)│
│  - Storage (attachments)   │      │   - Public Holiday API       │
│  - Scheduled Edge Functions│      │   - SMTP (Nodemailer)        │
│    (holiday sync, digest)  │      │     via Workspace SMTP relay │
└───────────────────────────┘      └─────────────────────────────┘
```

**Why this shape:**
- Next.js Route Handlers do the write-path (task CRUD, bulk CSV import, template application) so RLS + business rules (locking, auto-complete) are enforced server-side, not just in Postgres policies.
- Two schedulers, not one: Vercel Cron for anything tied to the app's request lifecycle (simplest ops story since we're already on Vercel); Supabase's own `pg_cron`/Edge Function scheduling as a fallback if a job needs to run close to the data (e.g. the nightly public-holiday sync). Pick one primary at kickoff — don't run both for the same job.
- Nodemailer sends through the client's existing Google Workspace SMTP relay (or a transactional provider like Resend/SES if Workspace SMTP sending limits become a problem at scale) — avoids standing up a separate email vendor relationship for a client who explicitly wants users managed "within Google Workspace."

---

## 4. Data model (high-level)

This is the original planning sketch — once building starts, `supabase/schema.md` is the
as-built source of truth (kept in sync with `supabase/migrations/`); this section stops
being updated once a table below actually exists there.

Core tables (Postgres via Supabase migrations, RLS on every table):

- `profiles` — mirrors `auth.users`, plus `role`, `google_group_id`, `department`
- `roles` — admin / standard_user / viewer, seeded, not user-editable
- `seasons` — code, name, start/end date, status
- `brands` — code, name, status
- `key_stages` — ordered lookup list (Design Brief, Range Review, Range Development, Range Refinement, Range Finalisation, …) seeded from the reference screenshots, editable by Admin
- `task_templates` — named sets of tasks (with relative due-date offsets) for "predefined templates to streamline task creation"
- `tasks` — task_name, season_id, brand_id, gender, key_stage_id, owner, assignee, due_date, status (not_started/in_progress/completed/overdue), is_locked, locked_by, locked_at, colour override, notes, comments (or separate `task_comments` table), created_at/updated_at/deleted_at
- `task_attachments` — Supabase Storage object refs
- `saved_views` — per-user saved filter/sort configs for the spreadsheet view
- `public_holidays` — country, date, label, source (`api` | `manual`)
- `employee_leave` — user_id, start_date, end_date, source (`manual` | `bulk_upload`)
- `reminder_rules` — scope (`individual` | `season` | `owner`), offset_days, target_id
- `notifications_log` — every reminder actually sent (for audit + "don't double-send" idempotency)
- `audit_log` — actor, action, entity, before/after, timestamp (covers the scope's "audit logging of key user actions")
- `sales_toolkit_links` — label, url, sort_order, category

This schema is a superset of what the core app needs but deliberately keeps `key_stage`, `updated_at`, soft-delete (`deleted_at`), and stable UUIDs consistent with the field names the client's Databricks spec used (`key_stage`, `season_code`, `brand_code`, etc.) — free future-proofing, not extra work now, since we'd want clean naming and soft deletes regardless.

**Fields to design in from the start** so the tables in `docs/databricks-integration-api-spec.md` are a thin read-layer over this schema later, not a rebuild: `version` (int, incremented on every update — the spec's optimistic-concurrency/change-tracking field), `season_code`/`brand_code` as stable short codes distinct from their UUID `id`s, `blocked_status`, `priority`, `days_at_risk`/`days_late` (derivable, but the spec expects them materialized), `delay_reason_code` (FK to a `delay_reason_codes` table — not yet in this schema, add it), `is_milestone`/`milestone_flag`, `escalation_owner_name`, and keeping `planned_*` vs `working_timeline_*` vs `actual_*` date fields distinct rather than collapsing them to one `due_date`. None of this is scope now — just don't pick column names or a shape that would need renaming later.

---

## 5. Delivery sequence

Six weeks (~42 days), sitting inside the client's 30–45 day ask, assuming a 2–3 dev team with frontend and backend/integration work running in parallel from week 2 onward. Each week ends with something demoable — important given the client is treating this as Priority 1 and wants fast feedback loops.

### Week 0 — Setup (kickoff, ~2–3 days, not counted against the 30-45 day clock)
- Confirm assumptions in §2 with client (roles, reminder cadence, Google Group mapping, holiday manual-override).
- Provision: Vercel project, Supabase project (Sydney region), GitHub repo (private, correct org), Google Cloud project + OAuth consent screen + domain-wide delegated service account for Admin SDK.
- Base Next.js + Supabase wiring, environment secrets, CI (lint/typecheck/build on PR).

### Week 1 — Auth, data model, task management core
- Supabase Postgres schema + RLS policies for all core tables (§4).
- Google Workspace SSO via Supabase Auth; gate sign-in to the client's domain; read Google Group membership on login to assign role.
- Spreadsheet-like task management screen: column-based filtering, inline editing, sort, save views.
- Task CRUD (create/edit/delete), fields per original scope + Key Stage/Notes from the addendum.
- **Demo**: log in via Google, see/filter/edit tasks in the grid.

### Week 2 — Bulk operations, templates, locking, colour rules
- CSV bulk task upload (with a downloadable template + validation/error reporting on bad rows).
- Predefined task templates (apply a template to a season/brand → generates a task set).
- Task locking: lock/unlock (Admin-only per §2), red highlight, edit-blocked prompt on due date change for locked tasks.
- Colour-coding by season.
- Scheduled job: auto-transition tasks to "Completed"... *(clarify with client: likely they mean auto-flag "Overdue" once due date passes while not completed — "Completed" implies the work is done, not just that time passed. Flag this precise wording back to the client in week 1 rather than building the wrong behaviour.)*
- Export to PDF/Excel from the task grid.
- **Demo**: bulk-import a season's tasks from CSV, apply a template, lock a task, see it turn red.

### Week 3 — Calendar, holidays, leave, Gantt/Timeline
- Calendar view (day/week/month), filter by season/brand/status, colour coding.
- Public holiday sync (API-driven, scheduled job) for AU/China/India/Türkiye + manual admin add/override.
- Manual + bulk-upload employee leave.
- Gantt/Timeline view with filter by Key Stage (not just individual tasks) — matches the "Timeline" tab in the client's reference screenshots.
- Google Calendar sync: push tasks to a user's Google Calendar, selectable individually / by season / by owner.
- **Demo**: calendar showing tasks + public holidays + leave overlays; Gantt filtered by Key Stage; a task appearing on a real Google Calendar.

### Week 4 — Dashboard, Upcoming Tasks, email reminders
- Dashboard: totals by season, completed/in-progress/overdue, % completion, breakdown by brand/gender/status, chart-based visualisation, export.
- Upcoming Tasks view: sorted by due date, filterable, highlighting near-due/overdue.
- Reminder rules UI (individually selected / by season / by owner, configurable lead time).
- Nodemailer + scheduled job: overdue reminder emails, idempotent via `notifications_log` so nobody gets double-emailed.
- **Demo**: dashboard with live numbers; set a reminder rule; trigger a test overdue email end-to-end.

### Week 5 — Sales Toolkit, security/audit, polish, mobile responsiveness
- Sales Toolkit page: curated links to Google Shared Drive locations (Admin-managed link list, per §4 `sales_toolkit_links`).
- Audit logging wired across create/update/delete actions; an Admin-facing audit log view.
- Data encryption in transit (enforced by Vercel/Supabase TLS) and at rest (Supabase default) — confirm and document, not build.
- Mobile responsiveness pass (desktop-first, but usable on mobile per scope).
- RLS/permission test pass across all three roles.
- **Demo**: full walkthrough as Administrator, Standard User, and Viewer roles.

### Week 6 — Hardening, UAT, launch
- Bug fixing from client UAT.
- Backup schedule confirmed and documented (Supabase point-in-time recovery / daily backups).
- Cost estimate finalised (Vercel + Supabase tiers based on actual user count, plus any paid holiday-API tier).
- Load a season's worth of real data, smoke-test bulk import + reminders + calendar sync against it.
- Cut over `criticalpath.threebyone.com.au` DNS, go live.

Weeks 1–5 map to the 30–45 day window; week 6 (hardening/UAT/launch) is where the plan flexes if the client's 30-day floor turns out too tight — it's the right place to absorb slippage since it's fixing/polishing known features rather than building new ones under time pressure.

---

## 6. Cut line if the 30-day floor is hard

If the client insists on 30 days flat rather than the 30–45 day range, the two features to defer to a fast-follow release (in order) are:

1. **Google Calendar push-sync** (view/dashboard/reminders all work without it; it's additive).
2. **Predefined task templates** (CSV bulk upload alone covers the "get a season's tasks in fast" need; templates are a convenience layer on top).

Everything else in §5 is either contractually explicit in the original scope PDF or directly requested in the client's follow-up email, so it's harder to defer without renegotiating scope.

---

## 7. Risks

- **Google Workspace domain-wide delegation approval** — this needs the client's Workspace super-admin to grant service-account access. If they're slow, SSO/role-sync work in week 1 stalls. Ask for this in the kickoff email, not week 1 day 1.
- **"Auto-complete on due date" ambiguity** (see week 2) — building the wrong behaviour costs a rebuild; clarify wording before Sprint 2 starts.
- **Public holiday API coverage/cost** — some free tiers rate-limit or don't cover Türkiye well; validate the chosen provider against all 4 countries before committing, not after.
- **Reminder cadence definition** — client said "TBC"; ship with the sane default in §2 but get sign-off by week 4, not at launch.
- **CSV bulk import data quality** — client will likely paste from their existing Airtable/Excel; build validation and a clear error report (row-level), or week 2's demo becomes a support ticket generator.

---

## 8. Explicitly out of scope for this engagement

- **TBO Critical Path Integration API Spec (Databricks/Kong)** — originally not being built (see the note in §1); reversed by later client direction. API-key issuance/auth (`/management/integrations`, `requireIntegrationApiKey()`), `GET /integration/v1/health`, `GET /integration/v1/seasons`, and `GET /integration/v1/brands` are now live. The rest — `task_history_snapshots`, the `/changes` feed, and every entity endpoint whose fields don't exist in this schema yet (`blocked_status`, `delay_reason_code`, `task_dependencies`, `is_milestone`, `planned_*`/`actual_*` dates, `version`, …) — is still unscheduled and gets picked up one endpoint at a time, each as its own scoping decision rather than inventing the columns it would need. Full spec kept at `docs/databricks-integration-api-spec.md`; as-built notes in `things-to-know.md`.
- **Employment Hero HR platform integration** — explicitly flagged by the client as "future phase" for leave sync.
