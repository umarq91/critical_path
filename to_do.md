# To Do

## Done
- Local Google OAuth client created (personal Gmail, Testing mode, own Gmail added as test user) and wired into Supabase Auth (Providers → Google + Site URL/Redirect URLs set to `localhost:3000`)

## Production checklist (dev setup above won't carry over as-is)
- New/updated OAuth consent screen for prod — currently "External + Testing" (capped at 100 manually-added test users). Two options: (a) publish it "In production" so any `@threebyone.com.au` user can sign in, or (b) recreate the GCP project under the client's own Google account so consent screen can be "Internal" (auto-restricted to their domain, no publishing review) — cleaner, but needs client to own/create it
- Decide who owns the GCP project long-term — per `plan.md` code-ownership clause, shouldn't stay under a personal Gmail
- Supabase Auth → Site URL + Redirect URLs → swap to `https://criticalpath.threebyone.com.au` (+ `/auth/callback`)
- Flip `NEXT_PUBLIC_GOOGLE_WORKSPACE_DOMAIN` back to `threebyone.com.au` in prod env vars
- If prod uses a different Supabase project than dev, the OAuth client's authorized redirect URI needs that project's `/auth/v1/callback` too

## Blocked on client
- **Using personal Gmail domain for dev now** (`gmail.com` in `.env.local`) — fine for everything except the two items below.
- **Real Workspace (`threebyone.com.au`) needed when:** we build Group→role sync (now, stubbed/no-op) and Calendar push-sync (week 3) — both need the client's super-admin to grant **domain-wide delegation** to our service account (Admin Console → Security → API Controls). Ask now, not at week 3, since approval can be slow.
- Confirm actual Google Group email addresses (`GOOGLE_GROUP_ADMIN_EMAIL` / `MANAGER`)
- Task-lock roles, reminder cadence, holiday manual-override — see `plan.md` §2 assumptions, need sign-off

## Not started
- Databricks/Kong integration API — explicitly out of scope (see `plan.md` §8, spec at `docs/databricks-integration-api-spec.md`). Hand the spec doc back to the client's data engineer at project handoff.
