"use client";

import { m } from "framer-motion";
import { PackageSearch, Search } from "lucide-react";
import { useTranslations } from "next-intl";

import { listContainer, listItem } from "@/animations";
import { cn } from "@/lib/utils";
import type { ItemType } from "@/types/item";

const ICONS: Record<ItemType, typeof Search> = {
  lost: Search,
  found: PackageSearch,
};

export function StepType({
  value,
  onSelect,
}: {
  value?: ItemType;
  onSelect: (type: ItemType) => void;
}) {
  const t = useTranslations("report");

  const options: { value: ItemType; icon: typeof Search; title: string; body: string }[] = [
    { value: "lost", icon: ICONS.lost, title: t("iLost"), body: t("iLostBody") },
    { value: "found", icon: ICONS.found, title: t("iFound"), body: t("iFoundBody") },
  ];

  return (
    <m.div
      variants={listContainer}
      initial="initial"
      animate="enter"
      className="grid gap-4 sm:grid-cols-2"
      role="radiogroup"
      aria-label={t("stepType")}
    >
      {options.map((option) => {
        const selected = value === option.value;
        return (
          <m.button
            key={option.value}
            variants={listItem}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onSelect(option.value)}
            className={cn(
              "flex flex-col items-start gap-3 rounded-2xl border-2 bg-card p-6 text-start transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              selected
                ? "border-primary"
                : "border-border hover:border-muted-foreground/40",
            )}
          >
            <span
              className={cn(
                "flex h-11 w-11 items-center justify-center rounded-xl",
                option.value === "lost"
                  ? "bg-lost/10 text-lost"
                  : "bg-found/10 text-found",
              )}
              aria-hidden
            >
              <option.icon className="h-5 w-5" />
            </span>
            <span className="text-base font-semibold">{option.title}</span>
            <span className="text-sm text-muted-foreground">{option.body}</span>
          </m.button>
        );
      })}
    </m.div>
  );
}
