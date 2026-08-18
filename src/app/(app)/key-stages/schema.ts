import { z } from "zod";

export const keyStageSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().max(500).optional(),
});

// Inline-edit/patch schema — same object as above, just made partial for single-field patches.
export const keyStageUpdateSchema = keyStageSchema.partial();

export type KeyStageInput = z.infer<typeof keyStageSchema>;
export type KeyStageUpdateInput = z.infer<typeof keyStageUpdateSchema>;
