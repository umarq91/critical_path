import "server-only";
import { formatDate } from "@/lib/dates";
import { publicEnv } from "@/lib/env";
import { ROUTES, TASK_LINK_PARAM } from "@/constants/routes";
import type { EmailMessage } from "@/lib/mailer/send";

export interface TaskReminderEmailInput {
  to: string;
  taskId: string;
  taskName: string;
  dueDate: string;
  seasonName: string | null;
  /** How many days before due_date this particular send corresponds to — a rule can fire more
   *  than once for the same task (e.g. both a 7-day and a 1-day reminder). */
  offsetDays: number;
}

// The one email this feature sends. Links to My Tasks with the task's drawer already open — every
// remindable task is in the recipient's own My Tasks scope (see listMyReminderCandidateTasks).
export function taskReminderEmail({ to, taskId, taskName, dueDate, seasonName, offsetDays }: TaskReminderEmailInput): EmailMessage {
  const whenLabel = offsetDays === 0 ? "today" : offsetDays === 1 ? "in 1 day" : `in ${offsetDays} days`;
  const subject = `Reminder: "${taskName}" is due ${whenLabel}`;
  const dueDateLabel = formatDate(dueDate);
  const seasonLine = seasonName ? ` (${seasonName})` : "";
  const link = `${publicEnv.NEXT_PUBLIC_APP_URL}${ROUTES.myTasks}?${TASK_LINK_PARAM}=${encodeURIComponent(taskId)}`;

  const text = `Reminder: "${taskName}"${seasonLine} is due ${dueDateLabel} — ${whenLabel}.\n\nView it: ${link}`;
  const html = `
    <p>Reminder: <strong>${escapeHtml(taskName)}</strong>${escapeHtml(seasonLine)} is due <strong>${dueDateLabel}</strong> — ${whenLabel}.</p>
    <p><a href="${link}">View this task</a></p>
  `.trim();

  return { to, subject, html, text };
}

// The only user-supplied strings landing in the HTML body are task/season names — escaped here
// rather than trusted, since either can contain characters an email client would render as markup.
function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
}
