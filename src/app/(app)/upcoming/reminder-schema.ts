import { z } from "zod";

// The three fixed presets the "Notify me" card always shows as checkboxes — a custom value is
// just another integer in the same offsetDays array, added alongside these, not a different kind
// of entry (see reminder_rules.offset_days in schema.md).
export const REMINDER_OFFSET_PRESETS = [
  { label: "2 days before", value: 2 },
  { label: "1 day before", value: 1 },
  { label: "1 week before", value: 7 },
] as const;

// Every hour of the day, in REMINDER_ORG_TIMEZONE (data/reminders.ts) — not restricted to
// "business hours": the person setting this may not be in that timezone (see the reminders
// note on Sydney-time hour picking), so the full 24 stay available rather than assuming what
// counts as a reasonable send time for them.
export const REMINDER_HOUR_OPTIONS = Array.from({ length: 24 }, (_, index) => index);

const MAX_OFFSETS = 10;
const MAX_TASKS = 100;

export const reminderTimingSchema = z.object({
  offsetDays: z
    .array(z.number().int().min(1, "Must be at least 1 day").max(365, "Must be 365 days or fewer"))
    .max(MAX_OFFSETS, `Choose at most ${MAX_OFFSETS} reminder timings`),
  notifyHour: z.number().int().min(0).max(23),
  isEnabled: z.boolean(),
});

export type ReminderTimingInput = z.infer<typeof reminderTimingSchema>;

export const reminderTasksSchema = z.object({
  taskIds: z.array(z.string().uuid()).max(MAX_TASKS, `Choose at most ${MAX_TASKS} tasks`),
});

export type ReminderTasksInput = z.infer<typeof reminderTasksSchema>;
