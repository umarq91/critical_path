import { z } from "zod";

export const taskGenderValues = ["men", "women", "unisex"] as const;
export const taskStatusValues = ["not_started", "in_progress", "completed", "overdue"] as const;

export const taskSchema = z.object({
  task_name: z.string().min(1, "Task name is required").max(200),
  season_id: z.string().uuid("Season is required"),
  brand_id: z.string().uuid("Brand is required"),
  gender: z.enum(taskGenderValues),
  due_date: z.string().min(1, "Due date is required"),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  assignee_id: z.string().uuid("Owner / assignee is required"),
  status: z.enum(taskStatusValues),
  notes: z.string().max(2000).optional(),
});

// Inline-edit/patch schema — same object as above, just made partial for single-field patches.
export const taskUpdateSchema = taskSchema.partial();

export type TaskInput = z.infer<typeof taskSchema>;
export type TaskUpdateInput = z.infer<typeof taskUpdateSchema>;
