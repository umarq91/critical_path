import "server-only";
import { formatDate } from "@/lib/dates";
import { publicEnv } from "@/lib/env";
import type { EmailMessage } from "@/lib/mailer/send";

export interface TaskReminderEmailInput {
  to: string;
  taskName: string;
  dueDate: string;
  seasonName: string | null;
  /** How many days before due_date this particular send corresponds to — a rule can fire more
   *  than once for the same task (e.g. both a 7-day and a 1-day reminder). */
  offsetDays: number;
}

// The one email this feature sends. Links to /my-tasks (where the reminder was configured and
// where the task itself is visible) rather than a task-specific deep link — TaskDetailDrawer is
// client-only state today, not URL-addressable, so there's nowhere more specific to send them.
export function taskReminderEmail({ to, taskName, dueDate, seasonName, offsetDays }: TaskReminderEmailInput): EmailMessage {
  const whenLabel = offsetDays === 0 ? "today" : offsetDays === 1 ? "in 1 day" : `in ${offsetDays} days`;
  const subject = `Reminder: "${taskName}" is due ${whenLabel}`;
  const dueDateLabel = formatDate(dueDate);
  const seasonLine = seasonName ? ` (${seasonName})` : "";
  const link = `${publicEnv.NEXT_PUBLIC_APP_URL}/my-tasks`;

  const text = `Reminder: "${taskName}"${seasonLine} is due ${dueDateLabel} — ${whenLabel}.\n\nView it: ${link}`;
  const html = `
    <p>Reminder: <strong>${escapeHtml(taskName)}</strong>${escapeHtml(seasonLine)} is due <strong>${dueDateLabel}</strong> — ${whenLabel}.</p>
    <p><a href="${link}">View your tasks</a></p>
  `.trim();

  return { to, subject, html, text };
}

// The only user-supplied strings landing in the HTML body are task/season names — escaped here
// rather than trusted, since either can contain characters an email client would render as markup.
function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
}
