# TODO

## High priority

- **Revert the "pretend-sent" reminder logging** once real `SMTP_*` creds are configured.
  `app/api/cron/task-reminders/route.ts` currently calls `recordReminderSent(...)` even when
  `sendMail()` reports `{ sent: false }` (no SMTP configured) — a deliberate, temporary testing
  convenience so a matched reminder is visible in Supabase's `notifications_log` before there's
  a relay to actually check against. Once `SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASS` are
  set for real: remove that `await recordReminderSent(...)` call from the `!result.sent` branch
  (revert to a plain `continue`), or every SMTP failure will also get silently logged as "done"
  and never retried. See `things-to-know.md`'s Reminders section for the full explanation.
