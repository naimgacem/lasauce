"use client";

import { m } from "framer-motion";
import { Check } from "lucide-react";
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

/** Progress indicator: animated bar + labelled dots; screen-reader friendly. */
export function WizardProgress({ step }: { step: number }) {
  const t = useTranslations("report");
  const WIZARD_STEPS = useWizardSteps();
  const total = WIZARD_STEPS.length;
  const pct = (step / (total - 1)) * 100;

  return (
    <div
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={total}
      aria-valuenow={step + 1}
      aria-valuetext={t("stepProgress", { n: step + 1, total, label: WIZARD_STEPS[step] })}
    >
      <div className="relative mx-3 h-1 rounded-full bg-muted">
        <m.div
          className="absolute inset-y-0 start-0 rounded-full bg-primary"
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        />
      </div>
      <ol className="mt-[-7px] flex justify-between">
        {WIZARD_STEPS.map((label, i) => {
          const done = i < step;
          const current = i === step;
          return (
            <li key={label} className="flex flex-col items-center gap-1.5">
              <span
                className={cn(
                  "flex h-[13px] w-[13px] items-center justify-center rounded-full border-2 bg-background transition-colors",
                  done || current ? "border-primary" : "border-muted",
                  done && "bg-primary text-primary-foreground",
                )}
              >
                {done ? <Check className="h-2 w-2" aria-hidden /> : null}
              </span>
              <span
                className={cn(
                  "hidden text-caption sm:block",
                  current ? "font-medium text-foreground" : "text-muted-foreground",
                )}
              >
                {label}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
