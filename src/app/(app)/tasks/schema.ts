import { z } from "zod";
import { parsePartyKey } from "@/lib/party";

// "unisex" is deliberately not offered here — client decision (0026_task_gender_rename.sql):
// only Guys/Girls going forward. The DB enum still permits "unisex" for the historical/seeded
// tasks that already have it (Postgres can't cleanly drop an enum value, and the client said not
// to worry about migrating existing data); it just can't be picked here for a new or edited task.
export const taskGenderValues = ["guys", "girls"] as const;
export const taskStatusValues = ["not_started", "in_progress", "completed", "overdue"] as const;
export const taskPriorityValues = ["high", "med", "low"] as const;
export const dpspCategoryValues = ["demand", "product", "sales", "profit"] as const;

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
  // brand_id and key_stage_id are optional here (though taskCreateSchema below requires both
  // at creation) because inline-edit reuses this base via taskUpdateSchema and still needs to
  // null one back out on an existing task — a season's critical path always has a season, but
  // plenty of stage work isn't brand-specific. Kept as loose strings (not .uuid()) so
  // inline-edit's "No brand" / "No key stage" options can submit their "none" sentinel, which
  // _actions.ts normalises to null before the DB write (see normaliseOptionalId).
  brand_id: z.string().optional(),
  key_stage_id: z.string().optional(),
  // Loose string, not z.enum(dpspCategoryValues) — same "none" sentinel pattern as brand_id/
  // key_stage_id above, for the same inline-edit reason (taskCreateSchema requires a real
  // value at creation; this base stays loose only so an existing task's category can be
  // cleared again later).
  dpsp_category: z.string().optional(),
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

// What the create form submits: the task columns plus its participant sets. brand_id,
// key_stage_id, dpsp_category and people_involved are optional on taskSchema/
// taskParticipantsSchema (inline-edit still needs to null them back out on an existing task —
// see normaliseOptionalId/normaliseDpspCategory in _actions.ts), but the client's confirmed
// minimum-fields-to-create-a-task list requires all of them up front, so creation overrides
// them here to be mandatory instead of loosening the shared base schema for everyone.
export const taskCreateSchema = taskSchema.merge(taskParticipantsSchema).extend({
  brand_id: z.string().uuid("Brand is required"),
  key_stage_id: z.string().uuid("Key Stage is required"),
  dpsp_category: z
    .string()
    .min(1, "DPSP Category is required")
    .refine((value) => (dpspCategoryValues as readonly string[]).includes(value), "DPSP Category is required"),
  people_involved: z.array(partyKeySchema).min(1, "At least one person involved is required"),
});

// Inline-edit/patch schema — the task columns only, made partial for single-field patches.
// Participants are deliberately NOT patchable here: they're rows in another table, so they go
// through setTaskParticipants/addTaskParticipant instead of a column update.
export const taskUpdateSchema = taskSchema.partial();

export type TaskInput = z.infer<typeof taskSchema>;
export type TaskCreateInput = z.infer<typeof taskCreateSchema>;
export type TaskUpdateInput = z.infer<typeof taskUpdateSchema>;
