import { z } from "zod";

export const seasonStatusValues = ["upcoming", "active", "completed"] as const;

export const seasonSchema = z.object({
  season: z.string().min(1, "Season is required").max(50),
  status: z.enum(seasonStatusValues),
  color: z.string().min(1, "Color is required"),
});

export const seasonUpdateSchema = seasonSchema.partial();

export type SeasonInput = z.infer<typeof seasonSchema>;
export type SeasonUpdateInput = z.infer<typeof seasonUpdateSchema>;
