"use client";

import { m } from "framer-motion";
import { PackageSearch, Search } from "lucide-react";

import { listContainer, listItem } from "@/animations";
import { cn } from "@/lib/utils";
import type { ItemType } from "@/types/item";

const options: {
  value: ItemType;
  icon: typeof Search;
  title: string;
  body: string;
}[] = [
  {
    value: "lost",
    icon: Search,
    title: "I lost something",
    body: "Describe it and we'll scan every found report — now and as new ones arrive.",
  },
  {
    value: "found",
    icon: PackageSearch,
    title: "I found something",
    body: "Post it so the owner can find it. We'll look for matching lost reports.",
  },
];

export function StepType({
  value,
  onSelect,
}: {
  value?: ItemType;
  onSelect: (type: ItemType) => void;
}) {
  return (
    <m.div
      variants={listContainer}
      initial="initial"
      animate="enter"
      className="grid gap-4 sm:grid-cols-2"
      role="radiogroup"
      aria-label="What are you reporting?"
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
              "flex flex-col items-start gap-3 rounded-2xl border-2 bg-card p-6 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
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
