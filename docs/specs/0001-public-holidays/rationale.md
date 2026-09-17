# 0001. Public holidays: rationale

## Context

The client's confirmed acceptance criteria (a QA sheet, not this codebase) test four rows.
"Public holiday sync" for Australia, China, India, and Turkey, each checked by viewing the
Calendar, plus a general "filtering ability." `plan.md`'s original scope sketch names the same
4 countries, a `public_holidays` table shape (`country, date, label, source`), and flags a real
risk. Some free tiers rate limit or don't cover Turkey well, so the chosen provider should be
validated against all 4 countries before committing, not after.

Nothing holiday related exists in the codebase yet. There is no table, no `lib/holidays/`, no nav
entry. `CLAUDE.md` anticipates the shape (a nightly cron, a swappable provider interface, an env
var named `PUBLIC_HOLIDAY_API_KEY`), but none of it is built.

Two forces shaped this decision beyond the provider pick itself. First, the project's cron
infrastructure has already moved on from what `CLAUDE.md` describes. There is no `vercel.json`,
because Vercel's free plan caps Cron at once a day. The one cron that exists (`task-reminders`)
is triggered by Supabase's own `pg_cron`/`pg_net` instead. Second, nothing in this schema
associates a task, profile, or department with a country, which rules out quietly folding
holidays into the existing due date/overdue calculation without a separate decision about whose
holidays govern which task.

## Options considered

### Option 1: Calendarific for all 4 countries

A single provider, one integration, one API key, behind the swappable `lib/holidays/provider.ts`
interface `CLAUDE.md` already anticipates.

**Pros**:
- Confirmed coverage for all 4 countries in one integration. No per country branching in the
  sync job.
- Free tier (500 requests a month) comfortably covers a nightly sync at this volume, about 8
  calls a night.

**Cons**:
- Needs a paid signup API key before it can run for real. That is a manual step outside this
  codebase.
- The coverage claim rests on the provider's own documentation and a research pass, not an
  independently fetched API response the way Nager.Date's was. Calendarific requires a key to
  query, so a keyless spot check isn't possible before that key exists.

### Option 2: Nager.Date (AU, China, Turkey) plus a second provider for India

Keeps the 3 confirmed free, keyless countries on Nager.Date and adds a small second integration
just for India.

**Pros**:
- No API key or signup needed for 3 of the 4 countries. Zero cost for most of the sync.
- Nager.Date's coverage for AU, China, and Turkey was verified directly against its live
  `AvailableCountries` endpoint during this design, not just claimed.

**Cons**:
- Two providers behind the one interface for one country's worth of benefit. More moving parts
  and two failure modes to reason about instead of one, for a feature whose total request volume
  is already trivial either way.
- Still needs a second provider decided and integrated for India specifically, which reintroduces
  the exact coverage risk plan.md flagged, just for a smaller scope.

### Option 3: Abstract API for all 4 countries

A single provider with confirmed coverage and a richer response shape (holiday type, day of
week).

**Pros**:
- Confirmed coverage for all 4 countries.
- Data verified monthly by the provider, per its own documentation.

**Cons**:
- Paid at meaningful volume ($99 a year for 5,000 requests a month) with no free tier suited to
  production use, versus Calendarific's free tier already covering this feature's actual volume.

## Rationale

Option 1 wins on the same force that ruled out Option 2. This feature's total request volume (4
countries, 2 years, once a night) is small enough that provider count is the variable to
minimize, not provider cost, since both Calendarific's free tier and a hybrid approach are
effectively free at this scale. One integration behind the swappable interface is simpler to
operate and reason about than two, and Calendarific's confirmed 4 country coverage removes the
exact risk plan.md called out. Abstract API (Option 3) would be the fallback if Calendarific's
coverage turns out to be wrong once a real key is provisioned and tested, since its confirmed
coverage comes at a real but modest cost ($99 a year) rather than Calendarific's free tier.

The one piece of this decision not independently verified is Calendarific's own coverage claim,
since testing it requires the paid signup key this spec's Follow-up asks for. That is a known,
accepted gap. `lib/holidays/provider.ts`'s swappable interface exists precisely so that if
Calendarific's real coverage disappoints once tested, swapping to Abstract API is a new file
behind the same interface, not a rewrite.

## References

**Project sources** (verifiable, in this repo):
- `CLAUDE.md`, the cron section and the `PUBLIC_HOLIDAY_API_KEY` placeholder
- `plan.md`, the original public holidays requirement and its explicit coverage validation risk
- `things-to-know.md`, the Reminders section's `pg_cron`/`pg_net` wiring

**Practices & standards**:
- Prefer one integration over two when request volume doesn't force a cost driven split

**Links** (web verified):
- Nager.Date: https://date.nager.at. Verified directly during this design via its
  `AvailableCountries` endpoint, which confirms AU, CN, and TR, and confirms India is absent.
- Calendarific: https://www.calendarific.com. Confirmed via research to cover AU, CN, IN, and TR,
  free tier 500 requests a month.
- Abstract API Holidays: https://www.abstractapi.com/holidays-api. Confirmed via research to
  cover all 4 countries, $99 a year for 5,000 requests a month beyond its more limited free tier.
