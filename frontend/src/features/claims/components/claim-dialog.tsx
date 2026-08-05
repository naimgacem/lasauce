"use client";

import * as React from "react";
import { KeyRound, ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";

import { Spinner } from "@/components/feedback/loading";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useSubmitClaim } from "@/features/claims/hooks/use-claims";
import type { Item } from "@/types/item";

/**
 * "Think this is yours?" — the claimant answers the reporter's verification
 * questions. Contact details are never exchanged here; that only happens if the
 * reporter approves.
 */
export function ClaimDialog({ item }: { item: Item }) {
  const t = useTranslations("claims");
  const tc = useTranslations("common");
  const [open, setOpen] = React.useState(false);
  const [answers, setAnswers] = React.useState<Record<string, string>>({});
  const [message, setMessage] = React.useState("");
  const submit = useSubmitClaim(item.id);

  const questions = item.claim_questions ?? [];
  const allAnswered = questions.every((q) => (answers[q] ?? "").trim().length > 0);
  // With no questions the message carries the whole burden of proof.
  const canSubmit = questions.length > 0 ? allAnswered : message.trim().length > 0;

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;
    await submit.mutateAsync({
      message: message.trim() || undefined,
      answers: questions.map((question) => ({
        question,
        answer: (answers[question] ?? "").trim(),
      })),
    });
    setOpen(false);
    setAnswers({});
    setMessage("");
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg">
          <KeyRound className="h-4 w-4" />
          {item.type === "found" ? t("thisIsMine") : t("iFoundThis")}
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {item.type === "found" ? t("proveYours") : t("tellFound")}
          </DialogTitle>
          <DialogDescription>
            {questions.length > 0
              ? t("answerQuestionsBody")
              : t("describeOnlyRightPerson")}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          {questions.map((question, i) => (
            <div key={question} className="space-y-2">
              <Label htmlFor={`claim-q-${i}`}>{question}</Label>
              <Textarea
                id={`claim-q-${i}`}
                rows={2}
                required
                value={answers[question] ?? ""}
                onChange={(e) =>
                  setAnswers((prev) => ({ ...prev, [question]: e.target.value }))
                }
                placeholder={t("answerPlaceholder")}
              />
            </div>
          ))}

          <div className="space-y-2">
            <Label htmlFor="claim-message">
              {t("anythingElse")}{questions.length > 0 ? ` (${tc("optional")})` : ""}
            </Label>
            <Textarea
              id="claim-message"
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t("messageExamplePlaceholder")}
            />
          </div>

          <p className="flex items-start gap-2 rounded-xl border bg-muted/40 p-3 text-caption text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            {t("privacyNote")}
          </p>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={submit.isPending}
            >
              {tc("cancel")}
            </Button>
            <Button type="submit" disabled={!canSubmit || submit.isPending}>
              {submit.isPending ? <Spinner /> : null}
              {t("submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
