import { z } from "zod";

// Typing "drive.google.com/…" is the common case, and rejecting it for want of a scheme would
// be pedantic — so a bare host is accepted and normalised to https:// on the way in. Everything
// downstream (the anchor's href, the stored value) can then assume an absolute URL.
const urlField = z
  .string()
  .min(1, "Link is required")
  .max(2000)
  .transform((value) => {
    const trimmed = value.trim();
    return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  })
  // A dotted host (or localhost) is required on top of parseability: prefixing turns a typo
  // like "drive" into the perfectly parseable "https://drive", which would be stored as a link
  // that goes nowhere.
  .refine((value) => {
    if (!URL.canParse(value)) return false;
    const { hostname } = new URL(value);
    return hostname === "localhost" || hostname.includes(".");
  }, "Enter a valid link");

export const externalLinkSchema = z.object({
  title: z.string().min(1, "Title is required").max(150),
  description: z.string().max(500).optional(),
  url: urlField,
});

// Inline-edit/patch schema — same object, made partial for single-field patches.
export const externalLinkUpdateSchema = externalLinkSchema.partial();

export type ExternalLinkInput = z.infer<typeof externalLinkSchema>;
export type ExternalLinkUpdateInput = z.infer<typeof externalLinkUpdateSchema>;
