# 0001. Public holidays: rationale

## Context

The client's confirmed acceptance criteria (a QA sheet, not this codebase) test four rows.
"Public holiday sync" for Australia, China, India, and Turkey, each checked by viewing the
Calendar, plus a general "filtering ability." `plan.md`'s original scope sketch named the same 4
countries, a `public_holidays` table shape, and an automatic API sync as the plan, with manual
add/override as a fallback in case the API missed something.

The first pass of this spec (2026-09-17) took that sketch at face value and designed around it:
a nightly sync from a paid provider, a swappable provider interface, a cron job, and manual entry
as the fallback path. That design was cross checked and accepted, but building was deliberately
paused (`blocker.md`) to get the client's actual answer on the one question that mattered most:
was automatic sync genuinely wanted, or would manual entry be enough?

The client's answer (2026-09-18) reframed the whole feature. There is no automatic sync at all.
An admin enters every holiday by hand, either one at a time through a form, or many at once
through a CSV file they fill in and upload. This is not a small tweak to the original design, it
replaces its central mechanism, so this update rewrites the Decision, Feature design, and Build
plan in place rather than only patching a field. Umar's own hint from the first round
("most probably it will have manually", recorded in `blocker.md`) called this outcome ahead of
the client's actual answer.

## Options considered

### Option 1 (original, now rejected): automatic sync from Calendarific

The first pass's design: a nightly job pulling all 4 countries from Calendarific, an admin manual
add as a fallback for whatever the API missed, behind a swappable provider interface.

**Pros**:
- Once running, holiday data updates itself every year with no admin effort.
- Confirmed coverage for all 4 countries in one integration (see the first pass's research,
  still valid as a record even though the decision changed).

**Cons**:
- Needs a paid signup API key and an external account, a real ongoing dependency for a company
  that, per the client's own answer, would rather just type the dates in.
- Adds a cron job, a provider abstraction, and a column that tracks where a row came from, purely
  to protect a synced row from being overwritten by the next sync. All of that machinery exists
  only because of the sync; remove the sync and it has nothing left to protect.
- Never independently verified: Calendarific's coverage claim rested on its own documentation
  and a research pass, since testing it required the same paid key this option needed in the
  first place.

### Option 2 (chosen): fully manual entry, single add plus CSV bulk import

An admin is the only source of holiday data. A form for one at a time, a CSV template download
and upload for many at once, and a results table after a bulk upload so the admin sees exactly
what happened to each row.

**Pros**:
- No external account, no API key, no cron job, nothing to provision before this can ship.
- Removes the exact coverage risk Option 1's Cons named: an admin enters exactly the holiday they
  intend, there is no automated feed that can get China's or Turkey's dates wrong.
- The CSV path keeps "add a whole year across 4 countries" fast even without automation, which
  is the actual gap entry with no automation at all would otherwise have.

**Cons**:
- Nothing updates on its own. If nobody adds next year's holidays, the Calendar just shows none
  for that year, and nothing in the system will notice or remind anyone.
- Relies on whoever enters the data getting country codes and date formats right, since a CSV
  template is a convention, not a dropdown; the row level validation and results table exist to
  catch this, but they only catch it after the fact, at upload time.

## Rationale

Option 2 wins because the actual requirement the client confirmed stopped being "keep 4 countries'
holiday calendars automatically in sync" and became "let an admin record the holidays that
matter, quickly." Once that is the real requirement, every piece of Option 1's added complexity
(the provider interface, the cron job, the source column and the flip it does on every edit, the
delete and reinsert scoping) is solving a problem, staying correct against a sync, that no longer
exists.
Building it anyway would be adding machinery for a scenario the client explicitly said isn't
theirs.

The tradeoff this decision accepts is real, not free: without a sync, this system will never
notice on its own that a year's holidays are missing. That risk is named directly in this spec's
Follow-up rather than solved here, since solving it (a reminder system, or a "data may be stale"
indicator) is a separate, smaller decision that can be added later without disturbing this one.

## References

**Project sources** (verifiable, in this repo):
- `CLAUDE.md`, the `papaparse` stack entry, named for CSV bulk import before this feature existed
- `plan.md`, the original public holidays requirement (this is the source Option 1 followed
  literally; the client's actual answer diverged from it)
- `docs/specs/0001-public-holidays/blocker.md`, the record of what was already confirmed
  (no effect on due dates, a distinct visual tag, multiple same day holidays allowed) versus what
  changed with this update (the sync approach itself)

**Practices & standards**:
- Prefer the requirement actually confirmed by the person who will use the feature over a scope
  document's original guess, even after design work has already gone into the guess

**Links** (kept for historical record only, no longer load bearing since Option 1 was not
chosen): Nager.Date (https://date.nager.at), verified directly during the first pass to cover AU,
CN, and TR but not India; Calendarific (https://www.calendarific.com), confirmed via research to
cover all 4 with a free tier of 500 requests a month; Abstract API Holidays
(https://www.abstractapi.com/holidays-api), confirmed via research to cover all 4 at $99 a year.
