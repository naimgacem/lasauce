import { z } from "zod";

/** Step 3 — Details. Validated with Zod via RHF before advancing. */
export const detailsSchema = z.object({
  title: z
    .string()
    .min(3, "Give it a short, descriptive title (at least 3 characters)")
    .max(255, "Title is too long"),
  description: z
    .string()
    .min(10, "A few more details will dramatically improve matching")
    .max(5000, "Description is too long"),
  lost_or_found_at: z
    .string()
    .min(1, "Select the date")
    .refine(
      (value) => new Date(value) <= new Date(),
      "The date can't be in the future",
    ),
  location_text: z.string().max(500, "Location is too long").optional(),
  color: z.string().max(80).optional(),
  brand: z.string().max(120).optional(),
});

export type DetailsValues = z.infer<typeof detailsSchema>;
