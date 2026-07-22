"use client";

import { m } from "framer-motion";
import { Tag } from "lucide-react";

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
  const { data: categories, isLoading } = useCategories();
  const flat = flattenCategories(categories).filter((c) => c.depth === 0);
  const children = flattenCategories(categories).filter((c) => c.depth > 0);

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-2xl" />
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
        aria-label="Category"
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
                "flex flex-col items-center justify-center gap-2 rounded-2xl border-2 bg-card p-4 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                selected
                  ? "border-primary"
                  : "border-border hover:border-muted-foreground/40",
              )}
            >
              <Tag
                className={cn(
                  "h-5 w-5",
                  selected ? "text-primary" : "text-muted-foreground",
                )}
                aria-hidden
              />
              <span className="text-sm font-medium leading-tight">
                {category.name}
              </span>
            </m.button>
          );
        })}
      </m.div>
      <p className="text-center text-xs text-muted-foreground">
        Not sure? You can continue without a category — it just helps matching.
      </p>
    </div>
  );
}
