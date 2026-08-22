import { z } from "zod";

export const brandStatusValues = ["active", "inactive"] as const;

export const brandSchema = z.object({
  brand_code: z.string().min(1, "Brand code is required").max(50),
  brand_name: z.string().min(1, "Brand name is required").max(100),
  description: z.string().max(500).optional(),
  status: z.enum(brandStatusValues),
  color: z.string().min(1, "Color is required"),
  // A brand can belong to more than one season (brand_seasons join table, 0013) — at least
  // one is still required, same as the old single-season_id requirement.
  season_ids: z.array(z.string().uuid()).min(1, "At least one season is required"),
});

// Inline-edit/patch schema — same object as above (no cross-field refine to strip, unlike
// seasons), just made partial for single-field patches.
export const brandUpdateSchema = brandSchema.partial();

export type BrandInput = z.infer<typeof brandSchema>;
export type BrandUpdateInput = z.infer<typeof brandUpdateSchema>;
