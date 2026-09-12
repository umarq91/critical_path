import { z } from "zod";
import { parsePartyKey } from "@/lib/party";

export const taskGenderValues = ["men", "women", "unisex"] as const;
export const taskStatusValues = ["not_started", "in_progress", "completed", "overdue"] as const;
export const taskPriorityValues = ["high", "med", "low"] as const;

// A participant is addressed as a `kind:uuid` string on the wire — see lib/party.ts for why
// that encoding exists rather than two parallel id arrays per role.
const partyKeySchema = z.string().refine((value) => parsePartyKey(value) !== null, "Invalid selection");

// Owners and People Involved are not columns on `tasks` — they're rows in task_participants,
// written by createTask/setTaskParticipants after the task row itself. They live in this
// schema anyway so one parse validates the whole form submission.
export const taskParticipantsSchema = z.object({
  owners: z.array(partyKeySchema).min(1, "At least one owner is required"),
  people_involved: z.array(partyKeySchema),
});

export const taskSchema = z.object({
  task_name: z.string().min(1, "Task name is required").max(200),
  season_id: z.string().uuid("Season is required"),
  // brand_id and key_stage_id are both optional, unlike season_id — a task always sits on a
  // season's critical path, but plenty of stage work isn't brand-specific. Kept as loose
  // strings (not .uuid()) so the form/inline-edit "No brand" / "No key stage" options can
  // submit their "none" sentinel, which _actions.ts normalises to null before the DB write
  // (see normaliseOptionalId).
  brand_id: z.string().optional(),
  key_stage_id: z.string().optional(),
  gender: z.enum(taskGenderValues),
  // Nullable since 0022_tasks_due_date_optional.sql — some of the client's historical data has
  // no known due date. A task with no due_date still appears on the grid; see data/tasks.ts and
  // things-to-know.md's Tasks section for what that does to sorting/overdue/calendar/timeline.
  due_date: z.string().optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  status: z.enum(taskStatusValues),
  priority: z.enum(taskPriorityValues),
  notes: z.string().max(2000).optional(),
});

// What the create form submits: the task columns plus its participant sets.
export const taskCreateSchema = taskSchema.merge(taskParticipantsSchema);

// Inline-edit/patch schema — the task columns only, made partial for single-field patches.
// Participants are deliberately NOT patchable here: they're rows in another table, so they go
// through setTaskParticipants/addTaskParticipant instead of a column update.
export const taskUpdateSchema = taskSchema.partial();

export type TaskInput = z.infer<typeof taskSchema>;
export type TaskCreateInput = z.infer<typeof taskCreateSchema>;
export type TaskUpdateInput = z.infer<typeof taskUpdateSchema>;
