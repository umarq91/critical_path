import { z } from "zod";

// The three fixed presets the "Notify me" card always shows as checkboxes — a custom value is
// just another integer in the same offsetDays array, added alongside these, not a different kind
// of entry (see reminder_rules.offset_days in schema.md).
export const REMINDER_OFFSET_PRESETS = [
  { label: "2 days before", value: 2 },
  { label: "1 day before", value: 1 },
  { label: "1 week before", value: 7 },
] as const;

// Hours shown in the "send at" picker — every hour of a normal working day is enough; nobody
// configuring an email reminder needs 3am as an option.
export const REMINDER_HOUR_OPTIONS = Array.from({ length: 15 }, (_, index) => index + 6); // 6am–8pm

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
