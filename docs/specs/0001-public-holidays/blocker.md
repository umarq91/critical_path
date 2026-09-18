# Blocker: Public Holidays feature waiting on client answers (RESOLVED 2026-09-18)

**Status: resolved.** The client's answer came back and the spec has been updated to match
(`index.md` + `rationale.md`, both revised 2026-09-18). This file is kept as the historical record
of what was asked and answered; it's no longer a build blocker. `/develop` can proceed against the
current spec.

## What the client actually said (2026-09-18)

Q1 landed on the manual option, and the feature turned out simpler than either option originally
described: no automatic sync, no external provider, at all. An admin adds holidays one at a time
through a form, or in bulk through a downloadable CSV template they fill in and upload, with a
results table afterward showing which rows were created versus skipped. Fields: date, event name,
description, country. See `index.md` for the full rewritten spec and `rationale.md` for why Option
1 (automatic sync) was dropped rather than kept as a later enhancement.

The other 3 open questions (visibility, default country filter state, whether the country list
might grow) were not explicitly asked again once the scope simplified. The updated spec carries them
forward as the same recommended defaults as the first round (see its Follow-up section), not as
newly confirmed answers.

---

## Original content (for history)

**Branch**: `holidays-feature` (off `main`, nothing merged yet)
**State at the time this was written**: Spec written and internally accepted via `/architect`,
cross checked, three gaps found and fixed. Building was deliberately paused before `/develop` so
the client could confirm scope first.

### Why this file existed

This is Umar working with a real client (Threebyone). The client's own QA sheet gave the
acceptance criteria (4 country sync rows + "filtering ability"), but several real product
decisions were made as recommended defaults during the `/architect` design pass, not confirmed by
the client. This file was the durable record of that gap, so a restarted session (or a different
day) would pick up exactly where the previous one left off instead of working it out again.

### Answered already (by Umar directly, not the client, on 2026-09-17)

- **Q2, does this affect due dates: NO.** Confirmed out of scope. Holidays are informational
  only, just for knowing a day exists.
- **Q5, visual treatment: YES, a special tag/highlight**, not a plain small label.
- **Q8, same day multiple holidays per country: YES, allow it.** Umar's reasoning: most holiday
  data will probably be entered manually, so duplicates/multiples on one date are plausible and
  should be allowed, not rejected. This also correctly hinted at the Q1 answer that came in the
  next day.

### What was still open, for the client, before the answer above

1. Sync approach (automatic vs manual). Answered: manual, see above.
2. Visibility (everyone including external, vs internal only). Not asked again; kept as "everyone."
3. Default Calendar filter state (all 4 vs narrower). Not asked again; kept as "all 4 on."
4. Country list (fixed 4 vs likely to grow). Not asked again; kept as "fixed 4 for now."
5. Sync failure visibility. No longer applicable, there is no sync.
