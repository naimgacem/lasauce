"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { detailsSchema, type DetailsValues } from "@/features/report/schemas";
import type { ReportDraft } from "@/store/draft.store";
import type { ItemType } from "@/types/item";

const today = () => new Date().toISOString().slice(0, 10);

export function StepDetails({
  draft,
  type,
  onAutosave,
  onValid,
  formId,
}: {
  draft: Partial<ReportDraft>;
  type: ItemType;
  /** Called (debounced) on every change so the draft store stays current. */
  onAutosave: (values: Partial<DetailsValues>) => void;
  /** Called when the step validates — the wizard advances. */
  onValid: (values: DetailsValues) => void;
  /** External submit: the wizard's Continue button targets this form. */
  formId: string;
}) {
  const form = useForm<DetailsValues>({
    resolver: zodResolver(detailsSchema),
    defaultValues: {
      title: draft.title ?? "",
      description: draft.description ?? "",
      lost_or_found_at: draft.lost_or_found_at ?? today(),
      location_text: draft.location_text ?? "",
      color: draft.color ?? "",
      brand: draft.brand ?? "",
    },
  });

  // Autosave: subscribe to changes, debounce writes to the draft store.
  React.useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const subscription = form.watch((values) => {
      clearTimeout(timer);
      timer = setTimeout(() => onAutosave(values as Partial<DetailsValues>), 400);
    });
    return () => {
      clearTimeout(timer);
      subscription.unsubscribe();
    };
  }, [form, onAutosave]);

  return (
    <Form {...form}>
      <form
        id={formId}
        onSubmit={form.handleSubmit(onValid)}
        className="space-y-5"
        noValidate
      >
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Title</FormLabel>
              <FormControl>
                <Input
                  placeholder={
                    type === "lost"
                      ? "e.g. Black leather wallet"
                      : "e.g. iPhone found on bus 12"
                  }
                  autoFocus
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea
                  rows={5}
                  placeholder="Distinctive marks, contents, stickers, where exactly it was…"
                  {...field}
                />
              </FormControl>
              <FormDescription>
                The matching engine reads this — every detail raises your odds.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid gap-5 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="lost_or_found_at"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {type === "lost" ? "Date lost" : "Date found"}
                </FormLabel>
                <FormControl>
                  <Input type="date" max={today()} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="location_text"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Location{" "}
                  <span className="font-normal text-muted-foreground">
                    (optional)
                  </span>
                </FormLabel>
                <FormControl>
                  <Input placeholder="e.g. Central Library, Main St" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="color"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Color{" "}
                  <span className="font-normal text-muted-foreground">
                    (optional)
                  </span>
                </FormLabel>
                <FormControl>
                  <Input placeholder="e.g. black" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="brand"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Brand{" "}
                  <span className="font-normal text-muted-foreground">
                    (optional)
                  </span>
                </FormLabel>
                <FormControl>
                  <Input placeholder="e.g. Fossil" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </form>
    </Form>
  );
}
