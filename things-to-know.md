# Things to Know

As-built constraints and decisions that are **invisible from the code alone** — why a window is
sized the way it is, which numbers are deliberately scoped differently from each other, what a
missing column forces the UI to do, what a query costs. One section per module.

**Read the relevant section before changing a module. Update it in the same PR when you change
behaviour it describes.** Terse and factual — not a changelog, not a design doc. When sources
disagree: `supabase/schema.md` (as-built DB) > this file (as-built behaviour) > `plan.md`
(original scope sketch).

---

## Dashboard (`/dashboard`)

**Cost: 3 Supabase calls for the page** (6 per load; the other 3 are the authenticated shell —
proxy `getUser`, layout `getUser` + profiles SELECT — and every route pays them). All 3 are
issued together via `Promise.all`.

**One query behind almost everything.** `getDashboardMetrics()` (`src/data/dashboard.ts`) makes
a single pass over `tasks` reading 5 narrow columns. Every tile and chart is a projection of it,
so no two cards can disagree. All filters and the Monthly/Weekly toggle run client-side over
already-loaded data — **0 requests on interaction**.

**The Gantt card is the exception, and has to be.** `getDashboardMetrics()` returns counts, not
task rows, and a bar needs an id, a name and three dates — so the card gets its own two queries
(`listTasksForTimeline` over the preview band, `listOverdueTasks`). Its season/brand dropdowns
are still built off `metrics.bySeason`/`byBrand` via `toFilterOptions()`, so there is no third
query for lookup options. It then filters those two result sets in the browser like every other
card — **still 0 requests on interaction**.

| Card | Basis |
|---|---|
| Stat tiles | All-time counts + share of total |
| Tasks by Season | Ranked by task count, **top 6**, tail folded into one "Other (N)" slice |
| Task Status Overview | All 4 enum statuses, enum order, never folded |
| Completion Rate | Completed vs. everything else |
| Tasks by Brand | Ranked by task count, **top 5**, tail truncated with an "N more" hint |
| Tasks by Gender | All 3 enum values |
| Task Completion | Completed per period + 4 window-scoped tiles |
| GANTT / Timeline | Preview band of tasks, capped at **12 rows**; see the Gantt gotchas below |

### Gotchas

- **There is no `completed_at` column.** Completion is bucketed by **due date**, so "May" means
  *"of the work due in May, this much is done"* — not "completed during May".
- **Monthly and Weekly window differently, on purpose.** Monthly = calendar-consecutive months
  spanning the data (cap 18), empty months shown. Weekly = the most recent 16 weeks *that have
  tasks due*, empties skipped — a readable week axis is ~16 bars but a year of history is 50+,
  so any trailing window lands on a stretch with no data and renders flat zero. A week with
  nothing due is no measurement, not 0%.
- **Task Completion's 4 tiles are window-scoped; the header tiles are all-time.** They are
  expected to differ. The card subtitle states its window.
- **The Status donut's centre % is pinned to overall completion**, not the current selection —
  otherwise scoping to "Overdue" would report 0% completion for the whole business.
- **Percentages are always against all tasks**, never the visible subset, so a brand's share
  doesn't change when the list is narrowed.
- **Season folds into "Other"; Brand truncates.** A bar list has no ring to complete, so a
  synthetic "Other" bar would outrank real brands. Both dropdowns list *every* entity.
- **Export is client-side CSV** from data already rendered — no second fetch, no Route Handler.
  It emits the **full** breakdowns, not the charts' trimmed top-N.
- **Scaling:** 1 request per 1000 live tasks (guard at 20 pages). Past ~20k tasks this belongs
  in a SQL view or RPC.
- Proxy and layout both validate the same token (calls #1 and #2). Inherent to the Supabase SSR
  pattern — middleware and RSC are separate contexts, so `cache()` can't bridge them.

### Gantt card gotchas (`timeline-gantt-card.tsx`)

- **Its controls are `useState`, not `nuqs` — deliberately, and against the usual house rule.**
  Every other list in the app puts view/filter state in the URL. Here that would make each
  filter click a real navigation, re-running `getDashboardMetrics()` (a full table scan) to
  redraw one card. The whole page is built on "fetch once, narrow in the browser", and this card
  follows it. `/timeline` is the URL-driven, shareable version.
- **Prev/Next clamp to the fetched band and disable at its edges.** The band is last month
  through next month (`getTimelinePreviewBand()`), padded to whole weeks. Stepping outside what
  was fetched would draw an empty chart that reads as "no tasks" rather than "not loaded". Widen
  the band and the query widens with it — `page.tsx` derives the query range from the same
  function the card clamps against, so they cannot drift.
- **Rows are capped at 12** (`TIMELINE_PREVIEW_ROW_COUNT`). The band can hold hundreds of tasks;
  a dashboard card that grows without limit stops being a summary. When the cap bites, the
  footer swaps the "click a bar" hint for a "Showing 12 of N" link into `/timeline`.
- **Off-window tasks are filtered out before `TimelineGrid`, not left to it.** `getBarGeometry()`
  returns `null` for them and the grid still renders the row — fine on `/timeline`, where the
  query is window-bounded, but here it would mean ~3 months of empty rows in Week view.
- **"View All" and the truncation link carry the card's current state** into `/timeline` as
  `view`/`date`/`seasonId`/`brandId`. Those keys must match `timelineSearchParams()`.
- The card's `loading.tsx` block hardcodes `h-[616px]` — 14 × the grid's 44px `ROW_HEIGHT`
  (12 rows + a 2-band header). Tailwind can't see a computed class, so it can't be derived from
  the constant; if either number changes, change this too.

---

## Timeline / Gantt (`/timeline`)

**Cost: 4 Supabase calls** — timeline tasks, overdue tasks, season options, brand options, all
issued together via `Promise.all`. View/period/filter changes re-run the Server Component
(`shallow: false`), so they re-query; scrolling and opening the drawer do not.

**This module has a second consumer.** The Dashboard's Gantt card renders `TimelineToolbar`,
`TimelineGrid`, `TimelineTaskBar`, `TimelineStatusLegend` and `TimelineOverduePanel` — the same
components, different state source (see the Dashboard section). None of them fetch; they take
tasks, a range and a view as props, which is what makes that possible. Keep it that way: a
`data/*` import inside any of them would break the preview. Only `TimelineWorkspace` and
`page.tsx` are `/timeline`-specific.

### Gotchas

- **`start_date` and `end_date` are nullable; `due_date` is not.** In practice almost every task
  has neither (2 of 34 at time of writing). So a bar's range is
  `start = start_date ?? due_date`, `end = end_date ?? due_date` — an unscheduled task renders
  as a **single-day milestone on its due date** rather than vanishing from the chart. Milestones
  are drawn with a dashed outline and a tinted fill so a defaulted width never reads as a real
  schedule. Strict `start_date`/`end_date`-only rendering would show 2 bars out of 34.
- **The coalescing exists twice and must stay in step**: `timelineBarRange()`
  (`timeline-utils.ts`) client-side, and `timelineOverlapFilter()` (`data/tasks.ts`) as its SQL
  mirror. If they disagree, the query and the geometry disagree about which tasks are visible.
- **Never `new Date(dateString)` on a date column.** Postgres `date` arrives as `"yyyy-MM-dd"`,
  which the native parser reads as *UTC* midnight — one day earlier for anyone at a negative UTC
  offset. Use `parseDateOnly()` (`lib/dates.ts`), which parses as local midnight. `formatDate()`
  goes through it too.
- **Bars are inclusive of both ends** — a task starting and ending the same day occupies one
  day, hence the `+1` in `getBarGeometry`. Bars clipped by the window get a squared-off edge so
  they read as continuing rather than genuinely ending at the screen edge.
- **The overdue panel is deliberately NOT window-scoped** — overdue work from an earlier month
  is exactly what shouldn't scroll out of sight. It does respect the season/brand filters.
- **Row alignment is structural, not synchronised.** The task column and its bar are the same
  DOM row inside one scroll container, with the left column `sticky left-0`. There is no scroll
  listener, and alignment cannot drift.
- **"Not Started" is grey, not blue** as an outside spec suggested — `status-notstarted-base`
  (`#94a3b8`) is the design system's token and wins over an external colour suggestion.
- Day gridlines are a `repeating-linear-gradient`, not one node per day — a 42-day month across
  many rows is a lot of DOM to buy a 1px line.
- **No drag-to-reschedule.** Read-only by design; writing dates back would need a mutation path
  and conflict rules that don't exist yet.
