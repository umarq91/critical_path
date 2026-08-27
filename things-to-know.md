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

**Cost: 1 Supabase call for the page** (4 per load; the other 3 are the authenticated shell —
proxy `getUser`, layout `getUser` + profiles SELECT — and every route pays them).

**One query behind everything.** `getDashboardMetrics()` (`src/data/dashboard.ts`) makes a
single pass over `tasks` reading 5 narrow columns. Every tile and chart is a projection of it,
so no two cards can disagree. All filters and the Monthly/Weekly toggle run client-side over
already-loaded data — **0 requests on interaction**.

| Card | Basis |
|---|---|
| Stat tiles | All-time counts + share of total |
| Tasks by Season | Ranked by task count, **top 6**, tail folded into one "Other (N)" slice |
| Task Status Overview | All 4 enum statuses, enum order, never folded |
| Completion Rate | Completed vs. everything else |
| Tasks by Brand | Ranked by task count, **top 5**, tail truncated with an "N more" hint |
| Tasks by Gender | All 3 enum values |
| Task Completion | Completed per period + 4 window-scoped tiles |

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
