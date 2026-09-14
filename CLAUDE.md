@AGENTS.md

# Critical Path — Architecture & Collaboration Guide

Internal task/critical-path tracker for Threebyone (TBO): spreadsheet-style task management, calendar + Gantt views, dashboards, holiday/leave-aware scheduling, and automated email reminders. Full product requirements live in `plan.md` — read it before touching a feature you don't recognize.

## Read before changing a module: `things-to-know.md`

**Mandatory, not advisory.** `things-to-know.md` holds one section per module recording the
decisions and constraints that are *invisible from the code* — why a window is sized the way it
is, which numbers are deliberately scoped differently from each other, what a column's absence
forces the UI to do, what a query costs. Reading the code alone will not tell you these, and
changing them "looks like a cleanup" right up until it silently breaks a number on screen.

- **Before** editing a module, read its section. If it has none, the file is still worth
  skimming — constraints cross module boundaries.
- **After** changing behaviour a section describes, update that section in the same PR. A stale
  entry is worse than a missing one.
- When you discover a non-obvious constraint that cost you real time to work out, add it. Keep
  entries terse and factual; this is not a changelog and not a design doc.

Precedence when sources disagree: `supabase/schema.md` (as-built DB) > `things-to-know.md`
(as-built behaviour) > `plan.md` (original scope sketch).

---

## Commands

```bash
npm run dev      # Start Next.js dev server
npm run build    # Production build
npm run start    # Start production server
npm run lint     # ESLint (max-warnings 0)
npx tsc --noEmit # Type check
```

---

## Stack

- **Next.js 16** (App Router) + React 19 + TypeScript
- **Tailwind CSS v4** + **shadcn/ui** (`base-nova` style, built on **Base UI**, not Radix — check a component's own source before assuming a Radix prop like `asChild` exists) + the token-based design system in `src/app/globals.css`, see "Design system" below
- **Supabase** — Auth (Google Workspace OAuth only), Postgres, Storage (task attachments), RLS
- **Supabase clients** — `@supabase/supabase-js` + `@supabase/ssr`
- **`@tanstack/react-table`** — headless engine for the spreadsheet-like task grid (sort/filter/column visibility). Pairs with shadcn's `<Table>` primitives; don't hand-roll a second table implementation for the Gantt/calendar row lists — reuse the same column defs where the data overlaps.
- **`nuqs`** — filter/sort/view state synced to the URL search params, not component state. This is what makes "save views" and "shareable filtered links" nearly free instead of a bespoke feature.
- **`zod`** for validation, **`react-hook-form`** for client forms
- **`nodemailer`** — reminder + notification email delivery via the client's Google Workspace SMTP relay
- **`googleapis`** — Google Admin SDK Directory API (read Group membership → role sync) and Google Calendar API (push task due dates), both via a single domain-wide-delegated service account
- **`papaparse`** — CSV bulk task import
- **`exceljs`** — Excel export (grid + dashboard)
- **`@react-pdf/renderer`** — PDF export, used only inside export Route Handlers (server-side, never bundled to the client)
- **`date-fns`** — all date math (due dates, business-day/holiday-aware overdue calculation, Gantt positioning)
- **`recharts`** (via shadcn `chart` components) for dashboard visualisations
- **`sonner`** for toasts, **`lucide-react`** for icons

### Do NOT install
- Any ORM (Prisma, Drizzle) — use SQL migrations + supabase-js + generated types
- NextAuth — Supabase Auth handles both sign-in paths (Google Workspace OAuth, and email+password for external users)
- Resend/SendGrid/Postmark — Nodemailer through the client's own Workspace SMTP relay is the confirmed requirement; only revisit if send volume genuinely exceeds relay limits, and treat that as a deliberate decision, not a default
- Redux/Zustand or any client state library — filter/sort/view state lives in the URL (`nuqs`); everything else is server state re-fetched via Server Components
- A third-party Gantt library — the timeline requirement (rows grouped by Key Stage, bars positioned by working-timeline dates) is simple enough to build as a lightweight CSS-grid component reusing the same task data and date helpers as the calendar view. Don't pull in a heavyweight scheduling library for this.
- A queue framework — cron-triggered Route Handlers are sufficient at this scale

---

## Next.js 16 specifics (load-bearing)

- `middleware.ts` is **deprecated** → renamed to **`proxy.ts`** with `export function proxy(...)`. Lives at `src/proxy.ts` (same level as `src/app`).
- Server Actions execute as **POST on their own route** → the proxy matcher catches them, but **always re-check `auth.getUser()` and role inside each Server Action**. Defense in depth.
- `cookies()` from `next/headers` is **async** — `await cookies()` in `lib/supabase/server.ts`.
- Before writing new Next.js code, read the relevant guide in `node_modules/next/dist/docs/`. Heed deprecation notices.

---

## File & Folder Structure

```
.
├── src/
│   ├── app/
│   │   ├── (app)/                        # Authenticated shell — role-aware sidebar nav
│   │   │   ├── layout.tsx                # Guards auth, loads current profile+role once
│   │   │   ├── dashboard/
│   │   │   │   └── page.tsx              # Charts via data/dashboard.ts
│   │   │   ├── tasks/                    # Primary module — spreadsheet grid
│   │   │   │   ├── page.tsx              # Reads searchParams (nuqs) → data/tasks.ts
│   │   │   │   ├── _actions.ts           # createTask, updateTask, deleteTask, lockTask, applyTemplate
│   │   │   │   ├── columns.tsx           # @tanstack/react-table column defs — SHARED by grid + export
│   │   │   │   ├── task-table.tsx        # Client: composes <DataTable> + inline-editable cells, adds nothing generic
│   │   │   │   ├── task-form.tsx         # Client: composes components/form-fields/* + zodResolver(taskSchema)
│   │   │   │   ├── import/
│   │   │   │   │   ├── page.tsx
│   │   │   │   │   ├── _actions.ts       # importTasksFromCsv — reuses taskSchema per row
│   │   │   │   │   └── dropzone.tsx
│   │   │   │   ├── export/route.ts       # GET → exceljs/PDF, reuses columns.tsx + data/tasks.ts
│   │   │   │   └── [taskId]/
│   │   │   │       ├── page.tsx          # Detail panel: comments, attachments, history
│   │   │   │       └── _actions.ts       # addComment, uploadAttachment
│   │   │   ├── calendar/
│   │   │   │   ├── page.tsx              # Reuses data/tasks.ts + data/holidays.ts + data/leave.ts
│   │   │   │   └── calendar-grid.tsx
│   │   │   ├── timeline/                 # Gantt view
│   │   │   │   ├── page.tsx              # Filter by Key Stage; reuses data/tasks.ts
│   │   │   │   └── timeline-rows.tsx
│   │   │   ├── upcoming/
│   │   │   │   └── page.tsx              # data/tasks.ts with a preset "due soon" filter
│   │   │   ├── sales-toolkit/
│   │   │   │   └── page.tsx              # data/sales-toolkit.ts (public read, admin-managed)
│   │   │   └── admin/                    # Admin-only route group (role-gated in layout)
│   │   │       ├── layout.tsx            # Redirects non-admins
│   │   │       ├── users/                # BUILT, at (app)/management/users — lists every account,
│   │   │       │                         #   creates external users, sets passwords/roles/
│   │   │       │                         #   departments, activates/deactivates
│   │   │       ├── teams/                # BUILT, at (app)/management/teams — "Teams / Departments".
│   │   │       │                         #   Department CRUD + member add/remove. Membership is
│   │   │       │                         #   profiles.department_id, so one department per person
│   │   │       ├── seasons/              # ┐
│   │   │       ├── brands/               # │ Each is: page.tsx (<DataTable> + columns.tsx) +
│   │   │       ├── key-stages/           # │ _actions.ts + a <FormDialog> composing the same
│   │   │       ├── templates/            # │ components/form-fields/* as task-form.tsx. Same
│   │   │       ├── holidays/             # │ shape every time — resist adding one-off table or
│   │   │       ├── leave/                # │ dialog code per entity; extend the generic pieces
│   │   │       ├── reminder-rules/       # ┘ instead. See "Shared, generic components" below.
│   │   │       ├── sales-toolkit/        # Manage the links shown at /sales-toolkit
│   │   │       └── audit-log/            # Read-only — <DataTable> with no <FormDialog>, no _actions.ts
│   │   ├── auth/
│   │   │   ├── layout.tsx
│   │   │   ├── sign-in/page.tsx          # TWO paths: "Continue with Google" for Workspace staff,
│   │   │   │                             #   email+password for admin-created `external` users
│   │   │   ├── google-button.tsx
│   │   │   ├── password-form.tsx         # signInWithPassword — external users only in practice
│   │   │   └── callback/route.ts         # exchangeCodeForSession → reconcileProfileRole → redirect.
│   │   │                                 #   Rejects non-Workspace emails, but NEVER deletes an
│   │   │                                 #   account that already has a profile row
│   │   ├── api/
│   │   │   └── cron/                     # Legitimate /api/* use: external scheduler trigger, not internal mutation
│   │   │       ├── reminders/route.ts        # Overdue/upcoming email dispatch
│   │   │       ├── status-rollover/route.ts  # Flags tasks overdue once due_date passes
│   │   │       ├── holiday-sync/route.ts     # Nightly public holiday API pull
│   │   │       └── group-sync/route.ts       # Nightly Google Group → role reconciliation
│   │   ├── integration/
│   │   │   └── v1/                       # Read-only external API (Databricks/Kong) — key-auth'd via
│   │   │       │                         #   requireIntegrationApiKey(), NOT under /api/* (base path
│   │   │       │                         #   is dictated by docs/databricks-integration-api-spec.md)
│   │   │       └── health/route.ts       # BUILT. Everything else in the spec is still a target
│   │   │                                 #   shape — see things-to-know.md before adding an endpoint
│   │   ├── layout.tsx
│   │   ├── page.tsx                      # Redirect → /dashboard
│   │   └── globals.css
│   │
│   ├── components/
│   │   ├── ui/                           # shadcn primitives, unmodified defaults
│   │   ├── icons/                        # Hand-built icon/logo components — NOT third-party brand
│   │   │   │                             #   assets (Google, etc.) or the app's own logo mark. Generic
│   │   │   │                             #   glyphs stay npm imports from lucide-react inline at the
│   │   │   │                             #   call site — this folder is only for things we drew or
│   │   │   │                             #   composed ourselves, so they have exactly one source of truth.
│   │   │   ├── google-logo.tsx           # Multi-colour "G" mark — svg has no lucide equivalent
│   │   │   └── critical-path-logo.tsx    # Wraps lucide's Asterisk — used by sidebar header + auth panel
│   │   ├── data-table/                   # Generic list-view engine — every table in the app is an instance
│   │   │   ├── data-table.tsx            # <DataTable columns data /> — @tanstack/react-table + shadcn <Table>.
│   │   │   │                             #   Pass queryState + rowCount and it runs in manual (server-paginated)
│   │   │   │                             #   mode — every real list does; local/uncontrolled mode is for
│   │   │   │                             #   genuinely small, unpaginated admin lookups only.
│   │   │   ├── data-table-toolbar.tsx    # Renders filter controls FROM a config array — see below
│   │   │   ├── data-table-pagination.tsx
│   │   │   ├── data-table-column-header.tsx  # Sortable header cell, one impl for every column everywhere
│   │   │   ├── data-table-search-params.ts   # ONE nuqs parser definition (page/pageSize/sortBy/sortDir/filters)
│   │   │   │                             #   shared by the client hook below AND Server Components — imports
│   │   │   │                             #   from "nuqs/server" (never bare "nuqs") since it's evaluated in
│   │   │   │                             #   both worlds and the main "nuqs" entry is a "use client" module.
│   │   │   ├── use-data-table-query-state.ts # Client hook wrapping the above in useQueryStates — required for
│   │   │   │                             #   every server-paginated table, not opt-in. See "Data flow" rules.
│   │   │   │                             #   Exposes `isPending` (via nuqs's startTransition option) — DataTable
│   │   │   │                             #   reads it to dim + spin during a filter/sort/page round trip.
│   │   │   ├── data-table-skeleton.tsx   # loading.tsx placeholder — configurable columnCount/rowCount/filterCount
│   │   │   └── use-row-editing.ts        # editingId + draft state for the pencil/tick inline-edit flow, generic
│   │   │                                 #   across tables — pairs with shared/editable-cell.tsx + row-edit-toggle.tsx
│   │   ├── form-fields/                  # Generic react-hook-form + shadcn field wrappers — one impl per input TYPE,
│   │   │   ├── text-field.tsx            #   not per entity. task-form, season-form, holiday-form etc. all compose these.
│   │   │   ├── select-field.tsx
│   │   │   ├── multi-select-field.tsx    # e.g. task "people_involved"
│   │   │   ├── date-field.tsx
│   │   │   ├── date-range-field.tsx
│   │   │   └── color-field.tsx           # Season/brand colour pickers
│   │   └── shared/                       # Cross-module, zero-fetch presentational components
│   │       ├── status-badge.tsx          # Generic <StatusBadge value config /> — task status, calendar
│   │       │                             #   sync_status, CSV import row result, template status all pass
│   │       │                             #   a different config map; nobody writes a second badge component.
│   │       ├── color-tag.tsx             # Generic <ColorTag label color /> — season, brand, key stage,
│   │       │                             #   DPSP category, delay-reason all render through this one component.
│   │       ├── form-dialog.tsx           # Generic <FormDialog title trigger>{form}</FormDialog> — every
│   │       │                             #   admin create/edit dialog uses this shell around its own form body.
│   │       ├── confirm-dialog.tsx        # Generic destructive-action confirm, used by every delete action
│   │       ├── filter-bar.tsx            # Thin shell around <DataTableToolbar>, kept for non-table filter UIs
│   │       │                             #   (calendar/timeline date-range + season/brand pickers)
│   │       ├── page-header.tsx           # Title + description + action-slot, used by every module's page.tsx
│   │       ├── empty-state.tsx
│   │       ├── stat-card.tsx             # Icon + label + value + description — dashboard tiles, Seasons'
│   │       │                             #   Total/Active/Upcoming/Completed row, reused wherever
│   │       ├── stat-card-skeleton.tsx    # Matching loading.tsx placeholder — same layout, no shifting on swap-in
│   │       ├── editable-cell.tsx         # Controlled inline-edit cell (text/select/date) — driven by a row's
│   │       │                             #   pencil/tick toggle, not per-cell click; see row-edit-toggle.tsx
│   │       └── row-edit-toggle.tsx       # Pencil ⇄ tick row-level edit toggle, paired with
│   │                                     #   data-table/use-row-editing.ts
│   │
│   ├── constants/
│   │   ├── routes.ts                     # ROUTES, PROTECTED_PREFIXES, ADMIN_PREFIXES
│   │   ├── roles.ts                      # ROLE.ADMIN | ROLE.STANDARD_USER | ROLE.VIEWER
│   │   ├── task-status.ts                # TASK_STATUS_CONFIG — consumed by <StatusBadge>, not a new component
│   │   └── colors.ts                     # Shared colour palette tokens — consumed by <ColorTag> and <ColorField>
│   │
│   ├── schemas/                          # zod — entities consumed by MORE THAN ONE surface
│   │   ├── task.ts                       # taskSchema — used by manual create/edit AND CSV import AND template apply
│   │   ├── csv-import.ts                 # Row-level wrapper around taskSchema + friendly error mapping
│   │   ├── season.ts
│   │   ├── brand.ts
│   │   ├── key-stage.ts
│   │   ├── template.ts
│   │   ├── holiday.ts
│   │   ├── leave.ts
│   │   └── reminder-rule.ts
│   │
│   ├── data/                             # Server-only reads. `import 'server-only'` at the top of every file.
│   │   ├── tasks.ts                      # listTasks(filters) — the ONE query fn behind grid/calendar/timeline/
│   │   │                                 #   upcoming/dashboard/export. Preset wrappers (listOverdueTasks,
│   │   │                                 #   listUpcomingTasks) just call listTasks with fixed filters.
│   │   ├── dashboard.ts                  # Aggregate queries (counts, completion %) — thin wrapper over tasks.ts
│   │   ├── seasons.ts
│   │   ├── brands.ts
│   │   ├── key-stages.ts
│   │   ├── templates.ts
│   │   ├── holidays.ts
│   │   ├── leave.ts
│   │   ├── users.ts
│   │   ├── sales-toolkit.ts
│   │   └── audit-log.ts
│   │
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── server.ts                 # createServerClient (RSC, Server Actions, Route Handlers)
│   │   │   ├── client.ts                 # createBrowserClient (Client Components only)
│   │   │   ├── admin.ts                  # Service-role client — Route Handlers / cron ONLY, never per-user
│   │   │   └── proxy.ts                  # updateSession used by proxy.ts
│   │   ├── google/
│   │   │   ├── auth.ts                   # Shared JWT/service-account client — every google/* module imports this
│   │   │   ├── admin-directory.ts        # resolveUserRole(email) — reads Group membership, maps → role
│   │   │   └── calendar.ts               # upsertCalendarEvent / deleteCalendarEvent — called from tasks/_actions.ts
│   │   ├── mailer/
│   │   │   ├── transport.ts              # Single nodemailer transport instance (Workspace SMTP relay)
│   │   │   ├── send.ts                   # send(template, data) — the only function that calls transport.sendMail
│   │   │   └── templates/                # One function per email: reminderDueSoon, reminderOverdue, digest
│   │   ├── holidays/
│   │   │   └── provider.ts               # Public holiday API client — swappable provider behind one interface
│   │   ├── permissions.ts                # can(role, action) — single capability matrix, used by UI AND Server Actions
│   │   ├── audit.ts                      # recordAuditEvent(...) — called from every mutating Server Action
│   │   ├── dates.ts                      # isOverdue, isBusinessDay, addBusinessDays — holiday/leave-aware
│   │   ├── csv.ts                        # parseTaskCsv — papaparse wrapper + row validation via schemas/csv-import.ts
│   │   └── utils.ts                      # cn() + small pure helpers
│   │
│   ├── types/
│   │   └── supabase.ts                   # Database type — regenerate via `supabase gen types`
│   │
│   └── proxy.ts
│
├── supabase/
│   ├── schema.md                          # As-built tables/columns/enums — read before any DB
│   │                                       #   decision, keep in sync with migrations below
│   └── migrations/
│       ├── 0001_profiles_roles.sql
│       ├── 0002_rename_role_manager_to_standard_user.sql
│       ├── 0003_seasons.sql
│       └── (brands, key stages, tasks + attachments/comments/locking, task templates,
│           saved views, holidays/leave, reminder rules/notifications log, sales toolkit
│           links, audit log — not built yet, numbering TBD as each lands)
│
├── vercel.json                           # Cron schedule → app/api/cron/* routes
├── components.json
├── tsconfig.json                         # paths: "@/*": ["./src/*"]
├── plan.md                               # Product requirements — source of truth for scope
├── things-to-know.md                     # Per-module as-built constraints — READ the relevant
│                                         #   section before changing a module, update it in the
│                                         #   same PR when behaviour it describes changes
├── AGENTS.md
└── CLAUDE.md
```

### Path alias
`@/*` resolves to `./src/*`. Always import via `@/…` from anywhere under `src/`.

### Folder conventions
- **Underscore prefix** (`_actions.ts`) marks files App Router will **not route**. Co-locate Server Actions with the route that owns them.
- **Route groups** — `(app)` scopes the authenticated shell; `admin/` inside it is role-gated in its own `layout.tsx`, not re-checked per page.
- **`schemas/` vs colocated `schema.ts`**: if a zod schema is consumed by exactly one Server Action + one form, colocate it next to that route (matches the `_actions.ts` pattern). The moment a **second, unrelated surface** needs the same shape — e.g. `taskSchema` validating both the manual task form *and* every row of a CSV import — promote it to `src/schemas/`. Don't pre-promote "just in case"; promote when the second consumer actually shows up.
- **`data/tasks.ts` is the only place task queries are written.** Every view-specific list (overdue, upcoming, by-season, calendar range, Gantt range, dashboard aggregates, CSV export) is a thin filtered call into `listTasks()`, not a bespoke query. If a view needs a shape `listTasks()` doesn't produce, extend the shared function's return type — don't fork a parallel query.
- **No barrel files (`index.ts` re-exports).** Import directly.
- **One component per file.** Split if a file exports more than one.

---

## Data flow — App Router idioms

| Operation | Where it lives | Pattern |
|---|---|---|
| **Read** (page load) | `src/data/<domain>.ts` | Server-only function called from a Server Component. Calls `createClient()` from `@/lib/supabase/server`. |
| **Write / mutation** | `src/app/**/_actions.ts` | `'use server'` Server Action co-located with the feature. Called from Client Components. |
| **Cross-cutting side effects** (audit log, calendar push, email) | Called **from inside** the relevant Server Action, via `lib/audit.ts` / `lib/google/calendar.ts` / `lib/mailer/send.ts` | Never duplicated per feature — one call site per concern, per action. |
| **Scheduled jobs** (reminders, status rollover, holiday sync, group sync) | `src/app/api/cron/*/route.ts` | Route Handler, triggered by Vercel Cron, protected by a shared-secret header (`lib/cron-auth.ts`). This is the one legitimate `/api/*` use case — an external scheduler, not an internal client. |
| **OAuth code exchange** | `src/app/auth/callback/route.ts` | Route Handler — the OAuth redirect carries a query param that only a Route Handler can receive. |
| **Export (CSV/Excel/PDF)** | `src/app/(app)/tasks/export/route.ts` | Route Handler — returns a binary/file response, which Server Actions can't do. Reuses `data/tasks.ts` + `columns.tsx`, doesn't re-implement filtering. |
| **Integration API** (external read-only access, e.g. Databricks/Kong) | `src/app/integration/v1/*/route.ts` | Route Handler, protected by `requireIntegrationApiKey()` (`lib/integration-auth.ts`) checking a per-key hash in `api_keys`, issued/revoked at `/management/integrations`. Lives at `/integration/v1/*`, **not** under `/api/*` — the base path is dictated by `docs/databricks-integration-api-spec.md`, and it's deliberately outside `PROTECTED_PREFIXES` (a machine caller has no Supabase session). Only `GET /health` exists so far — see `things-to-know.md`'s Integrations section before adding another endpoint here. |

### Rules

- **Server Components read.** Never fetch in `useEffect` what you can fetch in a Server Component.
- **Client Components mutate** via Server Actions imported directly.
- **Never create a `/api/…` route for internal mutations.** The only legitimate `/api/*` routes here are cron triggers, the OAuth callback, and file-producing exports — all genuinely external or non-JSON surfaces. (`/integration/v1/*` is a separate, narrower exception of its own — external read-only access, key-authenticated, not session-authenticated — and isn't under `/api/*` at all; see the table above.)
- **Always re-check `auth.getUser()` and role inside every Server Action** via `lib/permissions.ts`. The proxy and RLS are defense in depth, not the only checks.
- **Never expose `SUPABASE_SERVICE_ROLE_KEY` to the client.** It's used only in `lib/supabase/admin.ts`, imported only by Route Handlers (cron, export, `/integration/v1/*`) that need to bypass RLS for system-level reads/writes — never by Server Actions serving a single user's request, which always use the per-user `server.ts` client so RLS applies.
- **Locking is enforced in three places that must stay consistent**: RLS policy on `tasks.due_date` updates, `lib/permissions.ts` check inside `updateTask`, and the disabled state on the due-date field in `task-form.tsx`. If you change the lock rule, update all three.
- **Every `DataTable`-backed list paginates, filters, and sorts server-side — never fetch-all-then-slice client-side, and never keep that state in `useState`.** This is not optional per table; it's the only supported shape. Concretely, for a new `data/<domain>.ts` list function:
  - Its query function takes `{ page, pageSize, sortBy, sortDir, filters }` (see `ListSeasonsParams` in `data/seasons.ts`), applies each filter as a real Postgrest clause (`.ilike`/`.eq`/date-range, never a client-side `.filter()`), and returns `{ data, rowCount }` using `.range()` + `{ count: 'exact' }` — `data` is one page, never the whole table.
  - The page (`page.tsx`) is a Server Component that parses `searchParams` via `loadDataTableSearchParams` (`components/data-table/data-table-search-params.ts`) and passes the result straight into the list function — this is the same parser definition the client hook uses, so server and client can't drift apart.
  - The board/table Client Component calls `useDataTableQueryState()` and passes `queryState` + the real `rowCount` into `<DataTable>`, which then runs in manual mode (trusts `data` as already paginated/filtered/sorted — see `data-table.tsx`'s `queryState` prop).
  - Anything that needs the *whole* dataset regardless of the current page — stat-card counts, filter-dropdown options (e.g. distinct owners), a "date range" summary widget — is its **own** separate, narrow-column query (see `listSeasonSummary`/`listUpcomingSeasons` in `data/seasons.ts`), never derived from the paginated result.
  - `seasons` (schema + `data/seasons.ts` + `seasons/page.tsx` + `seasons/seasons-board.tsx`) is the reference implementation — copy its shape for `tasks`, `brands`, etc. rather than re-deriving it.
- **Every route with an async Server Component page gets a sibling `loading.tsx`** — not optional, same as the pagination rule above. Build it from `components/shared/stat-card-skeleton.tsx` and `components/data-table/data-table-skeleton.tsx` (pass roughly the real page's `columnCount`/`filterCount`/`rowCount` so nothing shifts when real content swaps in) rather than a generic spinner. `seasons/loading.tsx` is the reference.
  - This only covers the *first* navigation to the route (Next.js keeps existing content mounted during the `startTransition`-wrapped searchParams updates `useDataTableQueryState` makes, so `loading.tsx` doesn't re-fire on every filter click — that's deliberate, not a bug). For that in-page case, `useDataTableQueryState()` exposes `isPending` (via nuqs's `startTransition` option — omitting that option makes `isPending` permanently `false`), which `DataTable` already reads to dim the table and show a small spinner during the round trip. Don't rebuild this per page; it's automatic once `queryState` is passed to `DataTable`.

### Example — read (the "one query function per concern" pattern, server-paginated)

```ts
// src/data/tasks.ts
import 'server-only';
import { createClient } from '@/lib/supabase/server';

export interface ListTasksParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDir?: string;
  filters?: Record<string, string>; // e.g. { seasonId, status, dueBefore }
}

export async function listTasks({ page = 1, pageSize = 10, sortBy, sortDir, filters = {} }: ListTasksParams = {}) {
  const supabase = await createClient();
  let query = supabase
    .from('tasks')
    .select('*, season:seasons(*), key_stage:key_stages(*)', { count: 'exact' });

  if (filters.seasonId) query = query.eq('season_id', filters.seasonId);
  if (filters.status) query = query.eq('status', filters.status);
  if (filters.dueBefore) query = query.lte('due_date', filters.dueBefore);

  query = query.order(sortBy ?? 'due_date', { ascending: sortDir !== 'desc' });
  const from = (page - 1) * pageSize;
  const { data, error, count } = await query.range(from, from + pageSize - 1);
  if (error) throw error;
  return { data: data ?? [], rowCount: count ?? 0 };
}

// A "preset" wrapper still returns the same { data, rowCount } paginated shape — it's not
// exempt from pagination just because its filters are fixed instead of user-chosen.
export function listUpcomingTasks(params: Omit<ListTasksParams, 'filters'> = {}) {
  const dueBefore = new Date(Date.now() + 7 * 86_400_000).toISOString();
  return listTasks({ ...params, filters: { status: 'in_progress', dueBefore } });
}
```

### Example — write, with the cross-cutting concerns called from one place

```ts
// src/app/(app)/tasks/_actions.ts
'use server';
import { createClient } from '@/lib/supabase/server';
import { can } from '@/lib/permissions';
import { recordAuditEvent } from '@/lib/audit';
import { upsertCalendarEvent } from '@/lib/google/calendar';
import { taskSchema } from '@/schemas/task';

export async function updateTask(taskId: string, input: unknown) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: 'Not authenticated' };

  const parsed = taskSchema.partial().safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.message };

  const { data: before } = await supabase.from('tasks').select('*').eq('id', taskId).single();
  if (!can(user, 'task.update', before)) return { ok: false as const, error: 'Forbidden' };

  const { data: after, error } = await supabase
    .from('tasks').update(parsed.data).eq('id', taskId).select().single();
  if (error) return { ok: false as const, error: error.message };

  await recordAuditEvent({ actor: user.id, action: 'task.update', entityId: taskId, before, after });
  if (after.assignee_calendar_sync) await upsertCalendarEvent(after);

  return { ok: true as const, data: after };
}
```

---

## Auth flow

There are **two** sign-in paths, and an account only ever has one of them:

| | Google Workspace staff | External platform users |
|---|---|---|
| Sign in with | "Continue with Google" | Email + password |
| Account created by | First sign-in (`on_auth_user_created`) | An admin, at `/management/users` |
| Role | Resolved from Google Groups | Always `external`, fixed at creation |
| Google Calendar sync | Yes (one-way push) | Never |

There is deliberately **no third category** of "external user who happens to have a Google account". If an admin-created account's address is also a Google identity, that person still signs in with their password.

1. **Google sign-in** — `signInWithOAuth` with `hd` (hosted domain) locked to the client's Workspace domain. The domain is re-verified server-side in the callback; `hd` narrows the account chooser, it is not a boundary.
2. **Password sign-in** — `auth/password-form.tsx` calls `signInWithPassword` from the browser client. Supabase Auth owns the credential; no password is ever stored in, or passes through, our own tables.
3. **Callback** — `src/app/auth/callback/route.ts` exchanges the code, then calls `reconcileProfileRole()` (`lib/google/role-sync.ts`) to resolve the role from Google Group membership. **It must never delete an account that already has a `profiles` row** — Supabase links a Google identity onto an existing account with the same confirmed email, so an external user clicking the Google button arrives here as themselves; the reject path signs them out and points them at the password form instead.
4. **Proxy** (`src/proxy.ts`) refreshes the session on every request and redirects unauthenticated requests for `PROTECTED_PREFIXES` to `/auth/sign-in`.
5. **Per-page guard** — `(app)/layout.tsx` calls `auth.getUser()` once for the whole authenticated shell, and renders `DeactivatedNotice` (not a redirect — that ping-pongs against `proxy.ts`, whose session is still valid) when `status !== 'active'`. Pages whose whole purpose is off-limits to a role call `requirePageAccess(action)` (`lib/require-page-access.ts`) first: hiding a sidebar link is presentation, not authorization.
6. **Nightly reconciliation** — `api/cron/group-sync`, when it lands, must call `reconcileProfileRole()`, **never `resolveUserRole()` directly**. `resolveUserRole()` returns `viewer` — not null — for an account in no Google Group, and an external user is in no group by definition, so calling it directly would silently promote every external user to `viewer` and hand them the whole organisation's data.

`profiles` rows are created by an `on_auth_user_created` trigger — never insert manually.

---

## Permissions (`lib/permissions.ts`)

One capability matrix, imported everywhere a permission decision is made — UI, Server Actions, and mirrored in RLS. Do not reimplement role checks inline.

```ts
// src/lib/permissions.ts
export const ROLE = { ADMIN: 'admin', STANDARD_USER: 'standard_user', VIEWER: 'viewer', EXTERNAL: 'external' } as const;
export type Role = (typeof ROLE)[keyof typeof ROLE];

// Illustrative shape only — the real Action union and per-role allow-lists are the source
// of truth in lib/permissions.ts and are derived from the client's Role-Based Access
// screen, not this doc. Update both together if the matrix changes.
type Action =
  | 'task.create' | 'task.update' | 'task.delete'
  | 'task.lock' | 'task.edit_due_date_when_locked'
  | 'admin.manage_users' | 'admin.manage_lookups';

export function can(role: Role, action: Action, resource?: { isLocked?: boolean }): boolean {
  if (role === ROLE.ADMIN) return true;
  if (action === 'task.edit_due_date_when_locked') return !resource?.isLocked;
  return ROLE_ALLOWED[role]?.has(action) ?? false; // one explicit allow-set per role
}
```

**`external` is a first-class role, not "viewer with fewer rows".** Its allow-set is written
out in full rather than derived from `VIEWER_ALLOWED`, so a future grant to `viewer` can't
silently reach people outside the company. It gets `task.view` (scoped by RLS to tasks they
participate in), `dashboard.view` (rendered from that same scoped set) and
`profile.update_own` — no writes, no lookup/admin pages, no Google Calendar sync.

RLS policies encode the same rules server-side (defense in depth) — when the matrix above changes, update the matching migration in the same PR.

---

## Cron jobs

Configured in `vercel.json`, each hitting a Route Handler under `app/api/cron/`, each checking a `CRON_SECRET` header via a shared `lib/cron-auth.ts` guard — write that guard once, call it first line in every cron route.

| Route | Schedule | Does |
|---|---|---|
| `status-rollover` | Daily, early morning | Flags tasks `overdue` once `due_date` passes without completion — via `data/tasks.ts` + `lib/dates.ts`, not a duplicate query |
| `reminders` | Daily (or per confirmed cadence) | Reads `reminder_rules`, finds matching tasks via `listTasks()`, dedupes against `notifications_log`, sends via `lib/mailer/send.ts` |
| `holiday-sync` | Nightly | Pulls AU/China/India/Türkiye holidays via `lib/holidays/provider.ts`, upserts `public_holidays` where `source = 'api'` (manual rows untouched) |
| `group-sync` | Nightly | Re-resolves every profile's role via `lib/google/admin-directory.ts` |

---

## Design system

Source of truth: `Design and color palette.md` (client-provided). Every color/type/spacing/radius/shadow value in the app must trace back to a token from that file — never a raw hex or one-off pixel value in a component. If a value you need isn't in the file, that's a sign to check with whoever owns the design doc before inventing one, not to hardcode it.

**Where it lives in code**: `src/app/globals.css`. This project is Tailwind v4 (CSS-first config, no `tailwind.config.js`) — the design doc's "Tailwind `theme.extend`" JS snippet doesn't apply here; its `@theme inline` block is the real equivalent.

**Token → Tailwind class mapping** — the design doc uses its own token names (`--bg-app`, `--text-primary`, …); this codebase maps the ones that overlap with shadcn's existing semantic slots onto shadcn's names instead of duplicating them, so shadcn primitives (`Button`, `Card`, `Input`, …) pick up the palette automatically with zero per-component edits:

| Design doc token | Use in code | Design doc token | Use in code |
|---|---|---|---|
| `--bg-app` | `bg-background` | `--text-primary` | `text-foreground` |
| `--bg-surface` | `bg-card` / `bg-popover` | `--text-muted` | `text-muted-foreground` |
| `--bg-muted` | `bg-muted` | `--text-secondary` | `text-text-secondary` |
| `--border-default` | `border` / `border-border` | `--text-disabled` | `text-text-disabled` |
| `--color-primary` | `bg-primary` / `text-primary` | `--text-inverse` | `text-text-inverse` |

Tokens with **no shadcn equivalent** keep the doc's own name as a generated Tailwind utility (defined in `globals.css`'s `@theme inline`): `bg-primary-hover`, `bg-primary-tint`, `bg-brand`, `bg-brand-hover`, `bg-brand-tint`, `text-accent-teal`, `bg-status-{notstarted,progress,complete,overdue}-{base,soft,text}`, `bg-prio-{high,med,low}(-soft)`, `bg-viz-{1..7}`, `bg-viz-track`, `border-border-subtle`, `border-border-strong`, `bg-surface-{header,hover,overdue,selected}` (opaque `color-mix` flattenings of translucent table-row tints, needed because sticky columns can't be see-through — see `things-to-know.md` § Data tables).

**Typography** — the doc bundles size+line-height+weight per named style (`text-h1`, `text-body`, …), which Tailwind's default `text-*` scale can't express in one class. These are defined as custom `@utility` rules in `globals.css` — use `text-h1`, `text-body`, `text-label`, etc. directly; don't compose `text-[22px] leading-[30px] font-semibold` by hand.

**Spacing** — the doc's `space-1..space-16` scale (4px base grid) is numerically identical to Tailwind's default spacing scale (`space-4` = 16px = Tailwind's `4`). Just use standard Tailwind spacing utilities (`p-6`, `gap-5`, `px-4`) — no custom spacing tokens needed.

**Radius** — `rounded-xs` (6px) / `rounded-sm` (8px) / `rounded-md` (10px) / `rounded-lg` (12px) map to the doc's scale via `@theme inline` overrides. For pills (status badges, avatars), use Tailwind's built-in `rounded-full` — the doc's `radius-pill` is the same 9999px value, not a separate token.

**Shadows** — `shadow-sm`, `shadow-card`, `shadow-md`, `shadow-lg` are defined verbatim from the doc (note `shadow-card` is a real, distinct utility name, not a typo for `shadow-md`).

**Charts** — `src/constants/chart-colors.ts` exports `VIZ_COLORS`/`VIZ_TRACK_COLOR` as plain hex strings mirroring the `viz-*` CSS tokens, for charting libraries (Recharts) that take color values as props, not classes. Keep both in sync if the palette changes.

**Status/priority color → task field mapping** (e.g. `TASK_STATUS_CONFIG` consumed by the generic `<StatusBadge>` from "Shared, generic components" below) is deliberately **not** created yet — it depends on the tasks table's actual status enum values, which don't exist until that migration is written. Build it then, sourcing the hex values from the `status-*`/`prio-*` tokens already in `globals.css`.

**Dark mode is not specced** in the design doc (light-only, sampled from the live screens). `.dark` in `globals.css` still holds the original shadcn scaffold's default dark values as a non-broken fallback — don't invent brand dark-mode colors; get real values from the design doc's owner if/when the client asks for dark mode.

**Font**: Inter, wired via `next/font/google` in `src/app/layout.tsx` directly into the `--font-sans` CSS variable (not `--font-inter` or similar — the `@theme inline` block expects that exact name).

---

## Shared, generic components

The app has ~10 near-identical list-of-records screens (tasks, seasons, brands, key stages, templates, holidays, leave, reminder rules, sales-toolkit links, users, audit log) and a dozen-plus places that render "a coloured label for some status/category." Building each as a bespoke component is how a codebase this shape ends up with fifteen slightly-different tables and badges. The rule: **build the generic component once, drive every specific case through props/config — never fork a near-duplicate.**

Concretely:

| Generic component | Takes | Covers |
|---|---|---|
| `components/data-table/data-table.tsx` | `columns`, `data`, optional row-click/selection | Task grid, and every admin list screen (seasons, brands, key stages, templates, holidays, leave, reminder rules, sales-toolkit links, users, audit log) |
| `components/shared/status-badge.tsx` | `value: string`, `config: Record<string, {label, className}>` | Task status, calendar `sync_status`, CSV import row result, template status |
| `components/shared/color-tag.tsx` | `label: string`, `color: string` | Season tag, brand tag, key-stage tag, DPSP category, delay-reason tag |
| `components/shared/form-dialog.tsx` | `title`, `trigger`, `children` (the form body) | Every admin create/edit dialog (season, brand, key stage, template, holiday, reminder rule) |
| `components/shared/confirm-dialog.tsx` | `title`, `description`, `onConfirm` | Every delete action across tasks and admin entities |
| `components/form-fields/*` | react-hook-form `control` + `name` + field-specific props | Every form in the app — task form included — composes these instead of hand-wiring `FormField`/`FormControl`/`FormMessage` per input |

**Before adding a new component, check `components/data-table/`, `components/shared/`, and `components/form-fields/` for something that already does this shape.** If it's close but not quite right, extend its props — don't copy-paste it into a new file with a different name. A new component is justified only when the interaction is genuinely different (e.g. the Gantt/timeline rows aren't a table and don't belong in `data-table/`).

Example — one badge component, two unrelated call sites, config-driven:

```ts
// src/constants/task-status.ts
export const TASK_STATUS_CONFIG = {
  not_started: { label: 'Not started', className: 'bg-muted text-muted-foreground' },
  in_progress: { label: 'In progress', className: 'bg-blue-100 text-blue-800' },
  completed:   { label: 'Completed',   className: 'bg-green-100 text-green-800' },
  overdue:     { label: 'Overdue',     className: 'bg-red-100 text-red-800' },
} as const;

// src/constants/calendar-sync-status.ts
export const CALENDAR_SYNC_STATUS_CONFIG = {
  synced: { label: 'Synced', className: 'bg-green-100 text-green-800' },
  pending: { label: 'Pending', className: 'bg-amber-100 text-amber-800' },
  failed: { label: 'Failed', className: 'bg-red-100 text-red-800' },
} as const;
```

```tsx
// src/components/shared/status-badge.tsx
import { Badge } from '@/components/ui/badge';

type StatusConfig = Record<string, { label: string; className: string }>;

export function StatusBadge({ value, config }: { value: string; config: StatusConfig }) {
  const entry = config[value];
  return <Badge className={entry?.className}>{entry?.label ?? value}</Badge>;
}
```

```tsx
// used in tasks/columns.tsx
<StatusBadge value={task.status} config={TASK_STATUS_CONFIG} />

// used in calendar-events admin column, unrelated feature, zero new code
<StatusBadge value={event.sync_status} config={CALENDAR_SYNC_STATUS_CONFIG} />
```

Same principle for `data-table.tsx`: `tasks/columns.tsx` and `admin/seasons/columns.tsx` are both just `ColumnDef<T>[]` arrays passed into the same `<DataTable>` — the table component itself has no idea it's rendering tasks vs. seasons.

---

## Component rules

- **Generalize, don't fork.** See "Shared, generic components" above — check for an existing generic piece before writing a new one.
- **Shared components in `components/shared/`, `components/data-table/`, and `components/form-fields/` are zero-fetch** — they take data/config via props, no `data/*` or `schemas/*` imports inside them. That's what keeps them reusable across unrelated features.
- **Layout components are shells** — they don't fetch feature data, only auth/role.
- **No `useEffect` for derived state.** Compute inline or `useMemo`.
- **Inline vs extract** — extract only when reused elsewhere or it meaningfully improves separation. Don't extract to name a chunk.
- **Early returns over nested ternaries.**

---

## Forms

- **Client forms with validation** → `react-hook-form` + `zodResolver`, using the schema from `src/schemas/` when it's shared, or a colocated `schema.ts` when it's single-use. Submits by calling a Server Action directly from `onSubmit` — never through a fetch to a route.
- **Every field is a `components/form-fields/*` component**, not a hand-wired `FormField`/`FormControl`/`FormMessage` block. `task-form.tsx` and every admin entity form (season, brand, key stage, template, holiday, reminder rule) compose the same field components — `<TextField control name="task_name" />`, `<SelectField control name="season_id" options={seasons} />` — so a validation-message style fix or an accessibility fix happens once, not per form.
- **Server-side validation always re-runs the same zod schema** inside the Server Action. Client validation is UX, not the security boundary.
- **CSV import reuses `taskSchema`** per row (`schemas/csv-import.ts` wraps it with row-index error mapping) — do not write a second, looser validator for bulk import.

---

## Code quality rules

- **Never `any`.** Use `unknown` + narrowing, or a type in `src/types/`.
- No unused imports — `npm run lint` must pass with `--max-warnings 0`.
- No commented-out code — delete it.
- No magic strings inline — `src/constants/`.
- No `console.log` in production code.
- Keep files under ~250 lines — split when longer.
- `const` arrow functions for components; named exports.
- Default to writing **no comments**. Only add one when the WHY is non-obvious (a hidden invariant, a workaround, a constraint not visible from the code itself).
- Don't write comments describing what the code does — well-named identifiers do that.
- Don't reference the current task/ticket in comments — that belongs in the PR description.

---

## Environment

`.env.local` (see `.env.local.example`):

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
NEXT_PUBLIC_APP_URL=http://localhost:3000
SUPABASE_SERVICE_ROLE_KEY=...            # server only — lib/supabase/admin.ts

GOOGLE_WORKSPACE_DOMAIN=threebyone.com.au
GOOGLE_SERVICE_ACCOUNT_EMAIL=...
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY=...   # domain-wide delegated — Admin SDK + Calendar API
GOOGLE_ADMIN_IMPERSONATE_EMAIL=...       # Workspace super-admin the service account impersonates

SMTP_HOST=smtp-relay.gmail.com
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...

PUBLIC_HOLIDAY_API_KEY=...

CRON_SECRET=...                          # checked by every app/api/cron/* route
```

After any DB migration: `supabase gen types typescript --linked > src/types/supabase.ts`, and update `supabase/schema.md` in the same PR — read that file before any schema/RLS decision, it's the as-built source of truth over `plan.md` §4's original sketch.
