import { z } from "zod";

export const profileUpdateSchema = z.object({
  full_name: z.string().min(1, "Name is required").max(120),
});

export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
