"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "@/i18n/navigation";
import { m } from "framer-motion";
import { ArrowLeft, ArrowRight, History, Send } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

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
  useWizardSteps,
  WizardProgress,
} from "@/features/report/components/wizard-progress";
import type { DetailsValues } from "@/features/report/schemas";
import {
  useCreateItem,
  useUploadItemImages,
} from "@/features/items/hooks/use-items";
import {
  clearDraftImages,
  loadDraftImages,
  saveDraftImages,
} from "@/lib/draft-images";
import { ROUTES } from "@/lib/routes";
import { useDraftStore } from "@/store/draft.store";
import type { ItemType } from "@/types/item";

const DETAILS_FORM_ID = "report-details-form";

export function ReportWizard() {
  const t = useTranslations("report");
  const tc = useTranslations("common");
  const wizardSteps = useWizardSteps();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { draft, saveDraft, clearDraft } = useDraftStore();
  const create = useCreateItem();
  const upload = useUploadItemImages();

  const [images, setImages] = React.useState<LocalImage[]>([]);
  const [resumed, setResumed] = React.useState(false);
  /** Set the moment publishing succeeds — see `publish()` for why. */
  const [published, setPublished] = React.useState(false);

  // A draft is "meaningful" once the user got past picking a type.
  const hasMeaningfulDraft = Boolean(draft && (draft.step > 0 || draft.title));

  // Preset type from ?type= when starting fresh.
  const urlType = searchParams.get("type");
  React.useEffect(() => {
    if (!draft && (urlType === "lost" || urlType === "found")) {
      saveDraft({ type: urlType, step: 1 });
    }
    if (hasMeaningfulDraft) setResumed(true);

    // Photos are persisted separately (IndexedDB) because `File` can't be
    // JSON-serialised into the localStorage draft. Restore them with the rest
    // of the draft — without this a refresh brought the text back but silently
    // dropped every selected photo.
    let cancelled = false;
    if (hasMeaningfulDraft) {
      void loadDraftImages().then((files) => {
        if (cancelled || files.length === 0) return;
        setImages(
          files.map((file) => ({
            id: crypto.randomUUID(),
            file,
            // Object URLs are per-document; the originals died with the reload.
            previewUrl: URL.createObjectURL(file),
          })),
        );
      });
    } else {
      void clearDraftImages(); // orphans from a published or abandoned draft
    }
    return () => {
      cancelled = true;
    };
    // run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Mirror every picker change into IndexedDB so a refresh can't drop photos. */
  function updateImages(next: LocalImage[]) {
    setImages(next);
    void saveDraftImages(next.map((img) => img.file));
  }

  const step = draft?.step ?? 0;
  const type: ItemType = draft?.type ?? "lost";
  /** Publishing spans two requests — lock navigation across both. */
  const busy = create.isPending || upload.isPending;

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

  /**
   * Publish, then attach photos, then navigate.
   *
   * The order matters: once `create` resolves the report exists and is public.
   * A photo failure after that point must never look like the report was lost,
   * so it degrades to a warning and the user still lands on their live item.
   */
  async function publish() {
    if (!draft?.title || !draft.description || !draft.lost_or_found_at) {
      go(2); // shouldn't happen — details are validated before review
      return;
    }

    let item;
    try {
      item = await create.mutateAsync({
        type,
        title: draft.title,
        description: draft.description,
        category_id: draft.category_id || null,
        color: draft.color || null,
        brand: draft.brand || null,
        wilaya_code: draft.wilaya_code ?? null,
        claim_questions: draft.claim_question?.trim()
          ? [draft.claim_question.trim()]
          : [],
        location_text: draft.location_text || null,
        lost_or_found_at: new Date(draft.lost_or_found_at).toISOString(),
      });
    } catch {
      // useCreateItem's onError already surfaced the reason; stay on review so
      // the user can retry without retyping. Swallowing here also keeps the
      // click handler from rejecting into an unhandled promise.
      return;
    }

    let photosFailed = false;
    if (images.length > 0) {
      try {
        await upload.mutateAsync({
          itemId: item.id,
          files: images.map((img) => img.file),
        });
      } catch (error) {
        photosFailed = true;
        toast.warning(t("photosFailedTitle"), {
          description:
            error instanceof Error
              ? t("photosFailedBody", { message: error.message })
              : t("photosFailedBodyGeneric"),
          duration: 8000,
        });
      }
    }

    if (!photosFailed) {
      toast.success(t("publishedTitle"), {
        description: t("publishedBody"),
      });
    }

    // Freeze the wizard BEFORE clearing the draft. `clearDraft()` is a
    // synchronous store update, so without this the component re-renders at
    // step 0 ("What happened?") while the route transition is still in flight —
    // which looks exactly like publishing did nothing and left you behind.
    setPublished(true);
    images.forEach((img) => URL.revokeObjectURL(img.previewUrl));
    void clearDraftImages();
    clearDraft();
    // `replace`, not `push`: Back from the published report should return to
    // wherever the user came from, never into a now-empty wizard.
    router.replace(ROUTES.item(item.id));
  }

  function startOver() {
    clearDraft();
    images.forEach((img) => URL.revokeObjectURL(img.previewUrl));
    setImages([]);
    void clearDraftImages();
    setResumed(false);
    const presetStep = urlType === "lost" || urlType === "found" ? 1 : 0;
    if (presetStep === 1) saveDraft({ type: urlType as ItemType, step: 1 });
  }

  const headings: Record<number, { title: string; hint: string }> = {
    0: { title: t("step0Title"), hint: t("step0Hint") },
    1: { title: t("step1Title"), hint: t("step1Hint") },
    2: { title: t("step2Title"), hint: t("step2Hint") },
    3: { title: t("step3Title"), hint: t("step3Hint") },
    4: { title: t("step4Title"), hint: t("step4Hint") },
  };

  // The report is live and the draft is gone — hold this until the router
  // lands on the item page rather than flashing an empty step 0.
  if (published) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-3 py-24 text-center">
        <Spinner />
        <p className="text-body-sm text-muted-foreground" aria-live="polite">
          {t("redirecting")}
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <WizardProgress step={step} />

      {/* Resume banner */}
      {resumed ? (
        <div className="flex items-center gap-3 rounded-xl border bg-card p-3.5 text-sm">
          <History className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <p className="flex-1 text-muted-foreground">
            {t("resumedDraft")}
          </p>
          <Button variant="ghost" size="sm" onClick={startOver}>
            {t("startOver")}
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
        {step === 3 ? <StepImages images={images} onChange={updateImages} /> : null}
        {step === 4 ? <StepReview draft={draft ?? {}} type={type} images={images} /> : null}
      </m.div>

      {/* Navigation */}
      <div className="flex items-center justify-between border-t pt-5">
        {step > 0 ? (
          <Button variant="ghost" onClick={() => go(step - 1)} disabled={busy}>
            <ArrowLeft className="h-4 w-4" />
            {tc("back")}
          </Button>
        ) : (
          <span />
        )}

        {step === 2 ? (
          <Button type="submit" form={DETAILS_FORM_ID}>
            {tc("continue")}
            <ArrowRight className="h-4 w-4" />
          </Button>
        ) : step === 4 ? (
          <Button onClick={publish} disabled={busy}>
            {busy ? <Spinner /> : <Send className="h-4 w-4" />}
            {upload.isPending
              ? t("uploadingPhotos", { count: images.length })
              : create.isPending
                ? t("publishing")
                : t("publish")}
          </Button>
        ) : step > 0 ? (
          <Button onClick={() => go(step + 1)}>
            {tc("continue")}
            <ArrowRight className="h-4 w-4" />
          </Button>
        ) : null}
      </div>

      <p className="sr-only" aria-live="polite">
        {t("stepProgress", { n: step + 1, total: wizardSteps.length, label: wizardSteps[step] })}
      </p>
    </div>
  );
}
