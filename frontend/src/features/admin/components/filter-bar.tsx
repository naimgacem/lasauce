"use client";

import * as React from "react";
import { Search, X } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDebounce } from "@/hooks/use-debounce";
import { cn } from "@/lib/utils";

/** One row of filters above the table they scope. Wraps on narrow screens. */
export function FilterBar({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2">{children}</div>;
}

/**
 * Search box bound to a URL value. Local while typing, committed after a pause,
 * so each keystroke does not become a request (or a history entry).
 */
export function SearchField({
  value,
  onCommit,
  placeholder,
  className,
}: {
  value: string | undefined;
  onCommit: (value: string | undefined) => void;
  placeholder: string;
  className?: string;
}) {
  const t = useTranslations("admin.common");
  const [text, setText] = React.useState(value ?? "");
  const debounced = useDebounce(text, 300);
  //  What this field last wrote to the URL. A URL change that matches it is
  //  our own echo; anything else (Back, "clear filters") came from outside.
  const committed = React.useRef(value);

  React.useEffect(() => {
    //  Adopting our own echo would overwrite whatever was typed while the URL
    //  update was in flight.
    if (value !== committed.current) {
      committed.current = value;
      setText(value ?? "");
    }
  }, [value]);

  React.useEffect(() => {
    const next = debounced.trim() || undefined;
    if (next !== committed.current) {
      committed.current = next;
      onCommit(next);
    }
    // `onCommit` is recreated per render by callers; the debounced text is the trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  return (
    <div className={cn("relative w-full sm:w-72", className)}>
      <Search
        className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <Input
        type="search"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        aria-label={t("search")}
        className="h-9 ps-9"
      />
    </div>
  );
}

const ALL = "__all";

/**
 * A single-choice filter. "All" is a real option rather than an empty trigger,
 * so the current scope is always stated in words.
 */
export function FilterSelect<T extends string>({
  label,
  value,
  onChange,
  options,
  allLabel,
  className,
}: {
  label: string;
  value: T | undefined;
  onChange: (value: T | undefined) => void;
  options: { value: T; label: string }[];
  allLabel: string;
  className?: string;
}) {
  return (
    <Select value={value ?? ALL} onValueChange={(v) => onChange(v === ALL ? undefined : (v as T))}>
      <SelectTrigger aria-label={label} className={cn("h-9 w-auto min-w-[9.5rem]", className)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{allLabel}</SelectItem>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function ClearFilters({ onClear }: { onClear: () => void }) {
  const t = useTranslations("admin.common");
  return (
    <Button variant="ghost" size="sm" onClick={onClear} className="text-muted-foreground">
      <X className="h-4 w-4" />
      {t("clearFilters")}
    </Button>
  );
}
