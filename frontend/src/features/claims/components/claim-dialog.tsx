"use client";

import * as React from "react";
import { KeyRound, ShieldCheck } from "lucide-react";

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
          {item.type === "found" ? "This is mine" : "I found this"}
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {item.type === "found" ? "Prove it's yours" : "Tell them what you found"}
          </DialogTitle>
          <DialogDescription>
            {questions.length > 0
              ? "Answer the reporter's questions. They'll see your answers and decide."
              : "Describe something only the right person would know."}
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
                placeholder="Your answer…"
              />
            </div>
          ))}

          <div className="space-y-2">
            <Label htmlFor="claim-message">
              Anything else{questions.length > 0 ? " (optional)" : ""}
            </Label>
            <Textarea
              id="claim-message"
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="e.g. I lost it on Tuesday near the tram stop."
            />
          </div>

          <p className="flex items-start gap-2 rounded-xl border bg-muted/40 p-3 text-caption text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            Your contact details stay private. They&apos;re shared only if the
            reporter approves your claim.
          </p>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={submit.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit || submit.isPending}>
              {submit.isPending ? <Spinner /> : null}
              Send claim
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
