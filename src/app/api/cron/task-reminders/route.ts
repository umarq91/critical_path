import { NextResponse, type NextRequest } from "next/server";
import { requireCronAuth } from "@/lib/cron-auth";
import { listDueReminders, recordReminderSent } from "@/data/reminders";
import { sendMail } from "@/lib/mailer/send";
import { taskReminderEmail } from "@/lib/mailer/templates/task-reminder";

// Triggered every 15 minutes by Supabase pg_cron/pg_net (not Vercel's own Cron — see
// things-to-know.md's Reminders section), guarded by CRON_SECRET the same way every other
// app/api/cron/* route is. Fetches every (rule, task, offset) reminder due right now
// (listDueReminders already excludes anything notifications_log says was already sent), sends
// each by email, and logs it. One failed send never blocks the rest of the batch.
export async function GET(request: NextRequest) {
  const denied = requireCronAuth(request);
  if (denied) return denied;

  const due = await listDueReminders();

  let sent = 0;
  let failed = 0;
  let skippedNoSmtp = 0;
  for (const reminder of due) {
    try {
      const result = await sendMail(
        taskReminderEmail({
          to: reminder.profileEmail,
          taskName: reminder.taskName,
          dueDate: reminder.dueDate,
          seasonName: reminder.seasonName,
          offsetDays: reminder.offsetDays,
        })
      );

      if (!result.sent) {
        // SMTP isn't configured yet (getSmtpEnv() returned null) — deliberately NOT logged to
        // notifications_log, since nothing actually went out: this reminder must stay eligible
        // to send for real the moment SMTP_* is set, not be silently marked done today.
        skippedNoSmtp++;
        continue;
      }

      await recordReminderSent(reminder.ruleId, reminder.taskId, reminder.offsetDays);
      sent++;
    } catch {
      // A genuine send failure (relay rejected it, network error, etc.) is also left un-logged
      // — the next run (15 minutes later, still within the same matching hour) retries it
      // rather than silently dropping it for the day.
      failed++;
    }
  }

  return NextResponse.json({ matched: due.length, sent, failed, skippedNoSmtp });
}
