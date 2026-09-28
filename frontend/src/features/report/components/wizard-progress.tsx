"use client";

import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

const WIZARD_STEP_KEYS = [
  "stepType",
  "stepCategory",
  "stepDetails",
  "stepPhotos",
  "stepReview",
] as const;

/** Translated step labels — shared with the wizard for its sr-only progress text. */
export function useWizardSteps(): string[] {
  const t = useTranslations("report");
  return WIZARD_STEP_KEYS.map((key) => t(key));
}

/**
 * Segmented progress: one bar per step, filled up to the current one, with the
 * current step named in words. Dots on a hairline read as a loading spinner
 * at this size; segments read as "how far along", which is the only question
 * a progress indicator has to answer.
 */
export function WizardProgress({ step }: { step: number }) {
  const t = useTranslations("report");
  const steps = useWizardSteps();
  const total = steps.length;

  return (
    <div
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={total}
      aria-valuenow={step + 1}
      aria-valuetext={t("stepProgress", { n: step + 1, total, label: steps[step] })}
    >
      <div className="flex items-baseline justify-between gap-4 text-caption font-normal">
        <span className="font-medium text-foreground">{steps[step]}</span>
        <span className="tabular-nums text-muted-foreground">
          {step + 1} / {total}
        </span>
      </div>
      <div className="mt-2 grid grid-cols-5 gap-1.5" aria-hidden>
        {steps.map((label, i) => (
          <span
            key={label}
            className={cn(
              "h-1 rounded-full transition-colors duration-300",
              i <= step ? "bg-primary" : "bg-border",
            )}
          />
        ))}
      </div>
    </div>
  );
}
