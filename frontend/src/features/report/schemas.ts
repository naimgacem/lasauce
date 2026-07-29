import { z } from "zod";

import { WILAYA_CODE_MAX, WILAYA_CODE_MIN } from "@/lib/algeria-wilayas";

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
  wilaya_code: z.coerce
    .number({ invalid_type_error: "Select a wilaya" })
    .int()
    .min(WILAYA_CODE_MIN, "Select a wilaya")
    .max(WILAYA_CODE_MAX, "Select a wilaya"),
  /** Free-text detail within the wilaya, e.g. "near the university gate". */
  location_text: z
    .string()
    .trim()
    .max(500, "Location is too long")
    .optional()
    .or(z.literal("")),
  color: z.string().max(80).optional(),
  brand: z.string().max(120).optional(),
  /**
   * Verification question a claimant must answer before contact details are
   * exchanged. Public, so it must not give the answer away — the UI says so.
   */
  claim_question: z
    .string()
    .trim()
    .max(300, "Keep the question short")
    .optional()
    .or(z.literal("")),
});

export type DetailsValues = z.infer<typeof detailsSchema>;
