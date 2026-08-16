import { z } from "zod";

export const seasonStatusValues = ["planning", "upcoming", "active", "completed"] as const;

// owner_id is deliberately not part of this schema — the creator becomes the owner,
// set server-side in _actions.ts from the authenticated user, never a form input.
export const seasonSchema = z
  .object({
    season_code: z.string().min(1, "Season code is required").max(50),
    season_name: z.string().min(1, "Season name is required").max(100),
    status: z.enum(seasonStatusValues),
    start_date: z.string().min(1, "Start date is required"),
    end_date: z.string().min(1, "End date is required"),
    color: z.string().min(1, "Color is required"),
  })
  .refine((data) => data.end_date >= data.start_date, {
    message: "End date must be on or after start date",
    path: ["end_date"],
  });

export type SeasonInput = z.infer<typeof seasonSchema>;
