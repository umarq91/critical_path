import { z } from "zod";

// Single consumer (create-api-key-dialog.tsx) — stays colocated rather than promoted to
// src/schemas/, per CLAUDE.md's "promote on the second consumer" rule.
export const apiKeyCreateSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
});

export type ApiKeyCreateInput = z.infer<typeof apiKeyCreateSchema>;
