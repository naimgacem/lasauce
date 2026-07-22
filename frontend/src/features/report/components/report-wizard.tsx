"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { m } from "framer-motion";
import { ArrowLeft, ArrowRight, History, Send } from "lucide-react";

import { pageVariants } from "@/animations";
import { Spinner } from "@/components/feedback/loading";
import { Button } from "@/components/ui/button";
import { StepCategory } from "@/features/report/components/step-category";
import { StepDetails } from "@/features/report/components/step-details";
import {
  StepImages,
  type LocalImage,
} from "@/features/report/components/step-images";
import { StepReview } from "@/features/report/components/step-review";
import { StepType } from "@/features/report/components/step-type";
import {
  WIZARD_STEPS,
  WizardProgress,
} from "@/features/report/components/wizard-progress";
import type { DetailsValues } from "@/features/report/schemas";
import { useCreateItem } from "@/features/items/hooks/use-items";
import { useDraftStore } from "@/store/draft.store";
import type { ItemType } from "@/types/item";

const DETAILS_FORM_ID = "report-details-form";

export function ReportWizard() {
  const searchParams = useSearchParams();
  const { draft, saveDraft, clearDraft } = useDraftStore();
  const create = useCreateItem();

  const [images, setImages] = React.useState<LocalImage[]>([]);
  const [resumed, setResumed] = React.useState(false);

  // A draft is "meaningful" once the user got past picking a type.
  const hasMeaningfulDraft = Boolean(draft && (draft.step > 0 || draft.title));

  // Preset type from ?type= when starting fresh.
  const urlType = searchParams.get("type");
  React.useEffect(() => {
    if (!draft && (urlType === "lost" || urlType === "found")) {
      saveDraft({ type: urlType, step: 1 });
    }
    if (hasMeaningfulDraft) setResumed(true);
    // run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const step = draft?.step ?? 0;
  const type: ItemType = draft?.type ?? "lost";

  function go(next: number) {
    saveDraft({ ...(draft ?? { type }), type, step: next });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function selectType(selected: ItemType) {
    saveDraft({ ...(draft ?? {}), type: selected, step: 1 });
  }

  function autosaveDetails(values: Partial<DetailsValues>) {
    saveDraft({ ...(draft ?? { type, step: 2 }), type, step: 2, ...values });
  }

  function detailsValid(values: DetailsValues) {
    saveDraft({ ...(draft ?? { type, step: 2 }), type, ...values, step: 3 });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function publish() {
    if (!draft?.title || !draft.description || !draft.lost_or_found_at) {
      go(2); // shouldn't happen — details are validated before review
      return;
    }
    await create.mutateAsync({
      type,
      title: draft.title,
      description: draft.description,
      category_id: draft.category_id || null,
      color: draft.color || null,
      brand: draft.brand || null,
      location_text: draft.location_text || null,
      lost_or_found_at: new Date(draft.lost_or_found_at).toISOString(),
    });
    images.forEach((img) => URL.revokeObjectURL(img.previewUrl));
    clearDraft();
  }

  function startOver() {
    clearDraft();
    setImages([]);
    setResumed(false);
    const presetStep = urlType === "lost" || urlType === "found" ? 1 : 0;
    if (presetStep === 1) saveDraft({ type: urlType as ItemType, step: 1 });
  }

  const headings: Record<number, { title: string; hint: string }> = {
    0: { title: "What happened?", hint: "This determines which side we search." },
    1: { title: "Pick a category", hint: "Optional — but it sharpens matching." },
    2: { title: "Describe the item", hint: "Details are what the AI matches on." },
    3: { title: "Add photos", hint: "Optional — image matching loves them." },
    4: { title: "Review & publish", hint: "One last look before it goes live." },
  };

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <WizardProgress step={step} />

      {/* Resume banner */}
      {resumed ? (
        <div className="flex items-center gap-3 rounded-xl border bg-card p-3.5 text-sm">
          <History className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <p className="flex-1 text-muted-foreground">
            Picked up your unfinished draft right where you left it.
          </p>
          <Button variant="ghost" size="sm" onClick={startOver}>
            Start over
          </Button>
        </div>
      ) : null}

      {/* Step content — keyed remount gives each step a gentle entry */}
      <m.div
        key={step}
        variants={pageVariants}
        initial="initial"
        animate="enter"
        className="space-y-6"
      >
        <div className="space-y-1">
          <h1 className="text-xl font-bold tracking-tight md:text-2xl">
            {headings[step].title}
          </h1>
          <p className="text-sm text-muted-foreground">{headings[step].hint}</p>
        </div>

        {step === 0 ? <StepType value={draft?.type} onSelect={selectType} /> : null}
        {step === 1 ? (
          <StepCategory
            value={draft?.category_id}
            onSelect={(categoryId) =>
              saveDraft({ ...(draft ?? { type, step: 1 }), type, step: 1, category_id: categoryId })
            }
          />
        ) : null}
        {step === 2 ? (
          <StepDetails
            draft={draft ?? {}}
            type={type}
            onAutosave={autosaveDetails}
            onValid={detailsValid}
            formId={DETAILS_FORM_ID}
          />
        ) : null}
        {step === 3 ? <StepImages images={images} onChange={setImages} /> : null}
        {step === 4 ? <StepReview draft={draft ?? {}} type={type} images={images} /> : null}
      </m.div>

      {/* Navigation */}
      <div className="flex items-center justify-between border-t pt-5">
        {step > 0 ? (
          <Button variant="ghost" onClick={() => go(step - 1)} disabled={create.isPending}>
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        ) : (
          <span />
        )}

        {step === 2 ? (
          <Button type="submit" form={DETAILS_FORM_ID}>
            Continue
            <ArrowRight className="h-4 w-4" />
          </Button>
        ) : step === 4 ? (
          <Button onClick={publish} disabled={create.isPending}>
            {create.isPending ? <Spinner /> : <Send className="h-4 w-4" />}
            Publish report
          </Button>
        ) : step > 0 ? (
          <Button onClick={() => go(step + 1)}>
            Continue
            <ArrowRight className="h-4 w-4" />
          </Button>
        ) : null}
      </div>

      <p className="sr-only" aria-live="polite">
        Step {step + 1} of {WIZARD_STEPS.length}: {WIZARD_STEPS[step]}
      </p>
    </div>
  );
}
