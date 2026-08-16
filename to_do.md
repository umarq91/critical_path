# To Do

## Auth & roles — plain-English status (2026-08-16)

**What's actually done:** the "who's allowed to do what" rulebook (Administrator / Standard
User / Viewer) is written in code, and Google sign-in works end-to-end for local dev. Right
now we're signing in with personal Gmail accounts as a stand-in for the client's real
Workspace accounts — everything works the same way, just pointed at the wrong domain.

**Why "just swap gmail.com for the real domain" isn't quite enough:** that env var swap is
step 1 of 6. The other 5 aren't code changes we can make ourselves — they're account/config
steps, and three of them need the client's Workspace admin to say yes to something:

1. Change one setting (`NEXT_PUBLIC_GOOGLE_WORKSPACE_DOMAIN`) from `gmail.com` to
   `threebyone.com.au`. ← the easy one, purely our side.
2. **Role auto-assignment doesn't work yet.** The code that says "if you're in this Google
   Group, you're an Admin" is written, but we don't have the Group email addresses to check
   against. Until the client gives us those, every new person who signs in just becomes a
   Viewer by default — nobody gets auto-promoted.
3. For that Group-checking to work at all, the client's Workspace super-admin has to grant
   our app special read access to their Google Groups. This is a permission only they can
   grant, and it can be slow to get approved — worth asking for now, not later.
4. The "Sign in with Google" screen is currently locked to 100 manually-added test accounts
   (a Google testing-mode limit). Before real staff can use it, this needs to either be
   published for real use, or the whole Google project needs to move under the client's own
   Google account.
5. Tell Supabase "the real website lives at this address" instead of `localhost:3000`.
6. Decide who "owns" the Google project long-term — right now it's under a personal Gmail,
   which isn't where client-facing infrastructure should live.

Bottom line: step 1 alone would make sign-in redirect correctly, but nobody would get the
right role, and the sign-in screen itself would still reject anyone not manually
pre-approved. Steps 2–4 need the client; we should ask for all three at once rather than
discovering the blocker one at a time.

## Done
- Local Google OAuth client created (personal Gmail, Testing mode, own Gmail added as test user) and wired into Supabase Auth (Providers → Google + Site URL/Redirect URLs set to `localhost:3000`)
- Role-based access matrix (Administrator / Standard User / Viewer) written in `lib/permissions.ts`, matching the client's Role-Based Access screen

## Production checklist (dev setup above won't carry over as-is)
- New/updated OAuth consent screen for prod — currently "External + Testing" (capped at 100 manually-added test users). Two options: (a) publish it "In production" so any `@threebyone.com.au` user can sign in, or (b) recreate the GCP project under the client's own Google account so consent screen can be "Internal" (auto-restricted to their domain, no publishing review) — cleaner, but needs client to own/create it
- Decide who owns the GCP project long-term — per `plan.md` code-ownership clause, shouldn't stay under a personal Gmail
- Supabase Auth → Site URL + Redirect URLs → swap to `https://criticalpath.threebyone.com.au` (+ `/auth/callback`)
- Flip `NEXT_PUBLIC_GOOGLE_WORKSPACE_DOMAIN` back to `threebyone.com.au` in prod env vars
- If prod uses a different Supabase project than dev, the OAuth client's authorized redirect URI needs that project's `/auth/v1/callback` too

## Blocked on client
- **Using personal Gmail domain for dev now** (`gmail.com` in `.env.local`) — fine for everything except the two items below.
- **Real Workspace (`threebyone.com.au`) needed when:** we build Group→role sync (now, stubbed/no-op) and Calendar push-sync (week 3) — both need the client's super-admin to grant **domain-wide delegation** to our service account (Admin Console → Security → API Controls). Ask now, not at week 3, since approval can be slow.
- Confirm actual Google Group email addresses (`GOOGLE_GROUP_ADMIN_EMAIL` / `GOOGLE_GROUP_STANDARD_USER_EMAIL`)
- Task-lock roles, reminder cadence, holiday manual-override — see `plan.md` §2 assumptions, need sign-off

## Not started
- Databricks/Kong integration API — explicitly out of scope (see `plan.md` §8, spec at `docs/databricks-integration-api-spec.md`). Hand the spec doc back to the client's data engineer at project handoff.
