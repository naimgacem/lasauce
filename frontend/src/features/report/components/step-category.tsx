"use client";

import { m } from "framer-motion";
import { useTranslations } from "next-intl";

import { listContainer, listItem } from "@/animations";
import { Skeleton } from "@/components/ui/skeleton";
import {
  flattenCategories,
  useCategories,
} from "@/features/categories/hooks/use-categories";
import { cn } from "@/lib/utils";

export function StepCategory({
  value,
  onSelect,
}: {
  value?: string;
  onSelect: (categoryId: string | undefined) => void;
}) {
  const t = useTranslations("report");
  const { data: categories, isLoading } = useCategories();
  const flat = flattenCategories(categories).filter((c) => c.depth === 0);
  const children = flattenCategories(categories).filter((c) => c.depth > 0);

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-14 rounded-xl" />
        ))}
      </div>
    );
  }

  const all = [...flat, ...children];

  return (
    <div className="space-y-4">
      <m.div
        variants={listContainer}
        initial="initial"
        animate="enter"
        className="grid grid-cols-2 gap-3 sm:grid-cols-3"
        role="radiogroup"
        aria-label={t("stepCategory")}
      >
        {all.map((category) => {
          const selected = value === category.id;
          return (
            <m.button
              key={category.id}
              variants={listItem}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onSelect(selected ? undefined : category.id)}
              className={cn(
                "flex min-h-14 items-center rounded-xl border bg-card px-4 py-3 text-start text-body-sm font-medium leading-tight transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                selected
                  ? "border-primary bg-accent text-accent-foreground ring-1 ring-primary"
                  : "hover:border-muted-foreground/40",
              )}
            >
              {category.name}
            </m.button>
          );
        })}
      </m.div>
      <p className="text-caption font-normal text-muted-foreground">
        {t("notSureCategory")}
      </p>
    </div>
  );
}
