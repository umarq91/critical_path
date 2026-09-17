# Blocker: Public Holidays feature waiting on client answers

**Branch**: `holidays-feature` (off `main`, nothing merged yet)
**Spec**: `docs/specs/0001-public-holidays/index.md` (+ `rationale.md`) — status `Proposed`, not built
**State**: Spec written and internally accepted via `/architect`, cross-checked, three gaps found
and fixed (see the spec's Build plan). Building was deliberately paused before `/develop` so the
client can confirm scope first. Do NOT run `/develop` on this spec until the open questions below
are resolved and the spec is updated to match, especially Q1: it changes whether the sync route,
provider integration, and API key exist in the build at all.

## Why this file exists

This is Umar working with a real client (Threebyone). The client's own QA sheet gave the
acceptance criteria (4 country sync rows + "filtering ability"), but several real product
decisions were made as recommended defaults during the `/architect` design pass, not confirmed by
the client. This file is the durable record of that gap, so a restarted session (or a different
day) picks up exactly where this one left off instead of re-deriving it.

## Answered already (by Umar directly, not the client, on 2026-09-17)

- **Q2, does this affect due dates: NO.** Confirmed out of scope. Holidays are informational
  only, just for knowing a day exists. This matches what the spec already says; no spec change
  needed.
- **Q5, visual treatment: YES, a special tag/highlight**, not a plain small label. The spec
  currently says "small labeled chip at the top of the cell" (the earlier recommended default);
  revisit this against whatever "special tag or highlight" ends up meaning concretely (color?
  border? a distinct badge style?) before `/develop` builds the Calendar chip.
- **Q8, same-day multiple holidays per country: YES, allow it.** Umar's reasoning: most holiday
  data will probably be entered manually, so duplicates/multiples on one date are plausible and
  should be allowed, not rejected. This matches the spec's current data model already (unique on
  `country, holiday_date, name`, not `country, holiday_date`), so no spec change needed here
  either, but it's a signal worth noting: **Umar's phrasing ("most probably it will have
  manually") leans toward the manual bulk-add approach in Q1, not automatic sync.** Not a
  confirmed answer to Q1 itself, just a hint to weigh when that answer comes in.

## Still open, for the client

1. **Sync approach.** Option A (automatic nightly sync from a paid provider, e.g. Calendarific)
   vs Option B (one-off bulk add, sourced from a free API looked up manually or typed in from an
   official calendar, then maintained by hand roughly once a year). This is the big one: it
   decides whether the build includes a cron route, an external provider integration, and an API
   key at all, or is just the admin CRUD screen with a bulk-add mode. Umar's Q8 answer leans
   toward B being likely, but this needs the client's actual answer, not an inference.
2. **Visibility.** Should every signed in user (including external/collaborator accounts) see
   holidays on the Calendar, or internal staff only?
3. **Default view.** All 4 countries shown by default, or does it start narrower (e.g. only the
   user's own relevant country) until widened?
4. **Country list.** Fixed to exactly Australia, China, India, Turkey, or likely to grow (more
   offices/factories) later?
5. **Failure visibility** (only relevant if Q1 comes back Option A, automatic sync). Is a quiet
   server log enough for a failed nightly update, or does someone need to see an indicator that
   something didn't refresh?

## What to do when the client's answers come back

1. Update `docs/specs/0001-public-holidays/index.md` (and `rationale.md` if the reasoning
   changes) to match. Q1 landing on Option B is the biggest possible change: drop the cron route,
   the `lib/holidays/provider.ts`/`calendarific.ts` files, and `PUBLIC_HOLIDAY_API_KEY` from the
   Build plan and Configuration required section entirely, and add a bulk-add mode to the admin
   `/holidays` page instead (e.g. a paste-a-list-and-parse flow, or a repeatable add-row form) as
   a new build task.
2. Re-run the cross-check mentally (or for real, if the change is big enough) since Option B
   removes several of the earlier gaps this spec fixed (the "synced row vs manual edit" source
   flip and the delete-and-reinsert scoping stop mattering if there's no sync job at all).
3. Then run `/develop` against the updated spec.

See task #1 in the session's task list ("Resume Holidays feature build on holidays-feature
branch") for the same pointer.
