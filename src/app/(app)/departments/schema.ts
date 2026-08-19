import { z } from "zod";

export const departmentSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().max(500).optional(),
});

// Inline-edit/patch schema — same object as above, just made partial for single-field patches.
export const departmentUpdateSchema = departmentSchema.partial();

export type DepartmentInput = z.infer<typeof departmentSchema>;
export type DepartmentUpdateInput = z.infer<typeof departmentUpdateSchema>;
