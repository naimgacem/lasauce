"use client";

import { X } from "lucide-react";

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
import { ALGERIA_WILAYAS } from "@/lib/algeria-wilayas";
import type { ItemQuery } from "@/types/item";

const ALL = "all";

export type BrowseFilters = Pick<
  ItemQuery,
  "category_id" | "date_from" | "date_to" | "wilaya"
>;

export function countActiveFilters(filters: BrowseFilters): number {
  return [filters.category_id, filters.date_from, filters.date_to, filters.wilaya]
    .filter(Boolean).length;
}

/** Filter panel — rendered in the desktop sticky sidebar AND the mobile sheet. */
export function ItemFilters({
  value,
  onChange,
}: {
  value: BrowseFilters;
  onChange: (next: Partial<BrowseFilters>) => void;
}) {
  const { data: categories } = useCategories();
  const flat = flattenCategories(categories);
  const active = countActiveFilters(value);

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="filter-category">Category</Label>
        <Select
          value={value.category_id ?? ALL}
          onValueChange={(v) => onChange({ category_id: v === ALL ? undefined : v })}
        >
          <SelectTrigger id="filter-category">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All categories</SelectItem>
            {flat.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {`${"  ".repeat(category.depth)}${category.name}`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="filter-wilaya">Wilaya</Label>
        <Select
          value={value.wilaya ?? ALL}
          onValueChange={(v) => onChange({ wilaya: v === ALL ? undefined : v })}
        >
          <SelectTrigger id="filter-wilaya">
            <SelectValue placeholder="All wilayas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All wilayas</SelectItem>
            {ALGERIA_WILAYAS.map((wilaya) => (
              <SelectItem key={wilaya} value={wilaya}>
                {wilaya}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="filter-from">From</Label>
        <Input
          id="filter-from"
          type="date"
          value={value.date_from ?? ""}
          onChange={(e) => onChange({ date_from: e.target.value || undefined })}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="filter-to">To</Label>
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
              wilaya: undefined,
              date_from: undefined,
              date_to: undefined,
            })
          }
        >
          <X className="h-4 w-4" />
          Clear {active} filter{active === 1 ? "" : "s"}
        </Button>
      ) : null}
    </div>
  );
}
