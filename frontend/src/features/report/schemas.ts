import { useTranslations } from "next-intl";
import { z } from "zod";

import { WILAYA_CODE_MAX, WILAYA_CODE_MIN } from "@/lib/algeria-wilayas";

/** Step 3 — Details. Validated with Zod via RHF before advancing. */
export function useDetailsSchema() {
  const t = useTranslations("reportValidation");

  return z.object({
    title: z.string().min(3, t("titleTooShort")).max(255, t("titleTooLong")),
    description: z.string().min(10, t("descriptionTooShort")).max(5000, t("descriptionTooLong")),
    lost_or_found_at: z
      .string()
      .min(1, t("dateRequired"))
      .refine((value) => new Date(value) <= new Date(), t("dateInFuture")),
    wilaya_code: z.coerce
      .number({ invalid_type_error: t("wilayaRequired") })
      .int()
      .min(WILAYA_CODE_MIN, t("wilayaRequired"))
      .max(WILAYA_CODE_MAX, t("wilayaRequired")),
    /** Free-text detail within the wilaya, e.g. "near the university gate". */
    location_text: z.string().trim().max(500, t("locationTooLong")).optional().or(z.literal("")),
    color: z.string().max(80).optional(),
    brand: z.string().max(120).optional(),
    /**
     * Verification question a claimant must answer before contact details are
     * exchanged. Public, so it must not give the answer away — the UI says so.
     */
    claim_question: z.string().trim().max(300, t("claimQuestionTooLong")).optional().or(z.literal("")),
  });
}

export type DetailsValues = z.infer<ReturnType<typeof useDetailsSchema>>;
