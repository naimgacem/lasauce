"use client";

import { X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  flattenCategories,
  useCategories,
} from "@/features/categories/hooks/use-categories";
import { wilayasFor } from "@/lib/algeria-wilayas";
import type { ItemQuery } from "@/types/item";

const ALL = "all";

export type BrowseFilters = Pick<
  ItemQuery,
  "category_id" | "date_from" | "date_to" | "wilaya_code"
>;

export function countActiveFilters(filters: BrowseFilters): number {
  return [
    filters.category_id,
    filters.date_from,
    filters.date_to,
    filters.wilaya_code,
  ].filter((v) => v !== undefined && v !== "").length;
}

/** Filter panel — rendered in the desktop sticky sidebar AND the mobile sheet. */
export function ItemFilters({
  value,
  onChange,
}: {
  value: BrowseFilters;
  onChange: (next: Partial<BrowseFilters>) => void;
}) {
  const t = useTranslations("filters");
  const locale = useLocale();
  const { data: categories } = useCategories();
  const flat = flattenCategories(categories);
  const active = countActiveFilters(value);

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="filter-category">{t("category")}</Label>
        <Select
          value={value.category_id ?? ALL}
          onValueChange={(v) => onChange({ category_id: v === ALL ? undefined : v })}
        >
          <SelectTrigger id="filter-category">
            <SelectValue placeholder={t("allCategories")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("allCategories")}</SelectItem>
            {flat.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {`${"  ".repeat(category.depth)}${category.name}`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="filter-wilaya">{t("wilaya")}</Label>
        <Select
          value={value.wilaya_code != null ? String(value.wilaya_code) : ALL}
          onValueChange={(v) =>
            onChange({ wilaya_code: v === ALL ? undefined : Number(v) })
          }
        >
          <SelectTrigger id="filter-wilaya">
            <SelectValue placeholder={t("allWilayas")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("allWilayas")}</SelectItem>
            {wilayasFor(locale).map((wilaya) => (
              <SelectItem key={wilaya.code} value={String(wilaya.code)}>
                {wilaya.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="filter-from">{t("dateFrom")}</Label>
        <Input
          id="filter-from"
          type="date"
          value={value.date_from ?? ""}
          onChange={(e) => onChange({ date_from: e.target.value || undefined })}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="filter-to">{t("dateTo")}</Label>
        <Input
          id="filter-to"
          type="date"
          value={value.date_to ?? ""}
          onChange={(e) => onChange({ date_to: e.target.value || undefined })}
        />
      </div>

      {active > 0 ? (
        <Button
          variant="ghost"
          size="sm"
          className="w-full"
          onClick={() =>
            onChange({
              category_id: undefined,
              wilaya_code: undefined,
              date_from: undefined,
              date_to: undefined,
            })
          }
        >
          <X className="h-4 w-4" />
          {t("clearCount", { count: active })}
        </Button>
      ) : null}
    </div>
  );
}
