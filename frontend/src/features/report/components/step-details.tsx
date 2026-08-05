"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useDetailsSchema, type DetailsValues } from "@/features/report/schemas";
import { wilayasFor } from "@/lib/algeria-wilayas";
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
  const t = useTranslations("report");
  const tc = useTranslations("common");
  const locale = useLocale();
  const detailsSchema = useDetailsSchema();
  const form = useForm<DetailsValues>({
    resolver: zodResolver(detailsSchema),
    defaultValues: {
      title: draft.title ?? "",
      description: draft.description ?? "",
      lost_or_found_at: draft.lost_or_found_at ?? today(),
      wilaya_code: draft.wilaya_code,
      location_text: draft.location_text ?? "",
      claim_question: draft.claim_question ?? "",
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
              <FormLabel>{t("titleLabel")}</FormLabel>
              <FormControl>
                <Input
                  placeholder={
                    type === "lost"
                      ? t("titlePlaceholder")
                      : t("titlePlaceholderFound")
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
              <FormLabel>{t("descriptionLabel")}</FormLabel>
              <FormControl>
                <Textarea
                  rows={5}
                  placeholder={t("descriptionPlaceholder")}
                  {...field}
                />
              </FormControl>
              <FormDescription>
                {t("descriptionHint")}
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
                  {type === "lost" ? t("dateLostLabel") : t("dateFoundLabel")}
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
            name="wilaya_code"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("wilayaLabel")}</FormLabel>
                <Select
                  onValueChange={(v) => field.onChange(Number(v))}
                  value={field.value ? String(field.value) : ""}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder={t("wilayaPlaceholder")} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {wilayasFor(locale).map((wilaya) => (
                      <SelectItem key={wilaya.code} value={String(wilaya.code)}>
                        {wilaya.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="location_text"
            render={({ field }) => (
              <FormItem className="sm:col-span-2">
                <FormLabel>
                  {t("locationLabel")}{" "}
                  <span className="font-normal text-muted-foreground">
                    ({tc("optional")})
                  </span>
                </FormLabel>
                <FormControl>
                  <Input
                    placeholder={t("locationPlaceholder")}
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  {t("locationHint")}
                </FormDescription>
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
                  {t("colourLabel")}{" "}
                  <span className="font-normal text-muted-foreground">
                    ({tc("optional")})
                  </span>
                </FormLabel>
                <FormControl>
                  <Input placeholder={t("colourPlaceholder")} {...field} />
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
                  {t("brandLabel")}{" "}
                  <span className="font-normal text-muted-foreground">
                    ({tc("optional")})
                  </span>
                </FormLabel>
                <FormControl>
                  <Input placeholder={t("brandPlaceholder")} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="claim_question"
            render={({ field }) => (
              <FormItem className="sm:col-span-2">
                <FormLabel>
                  {t("claimQuestionLabel")}{" "}
                  <span className="font-normal text-muted-foreground">
                    ({tc("optional")})
                  </span>
                </FormLabel>
                <FormControl>
                  <Input
                    placeholder={
                      type === "found"
                        ? t("claimQuestionPlaceholderFound")
                        : t("claimQuestionPlaceholderLost")
                    }
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  {t("claimQuestionHint")}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </form>
    </Form>
  );
}
