"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { MapPin, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { wilayasFor } from "@/lib/algeria-wilayas";
import { ROUTES } from "@/lib/routes";

const ALL_ALGERIA = "all";

/**
 * The landing page's one primary action. A plain GET form to /search, so it
 * works before hydration and the query lands in the URL the browse view reads.
 */
export function HeroSearch() {
  const t = useTranslations("landing");
  const tc = useTranslations("common");
  const locale = useLocale();
  const [wilaya, setWilaya] = useState(ALL_ALGERIA);

  return (
    <form
      action={ROUTES.search}
      role="search"
      className="rounded-xl border bg-card p-1.5 shadow-sm transition-[border-color,box-shadow] duration-200 focus-within:border-primary/40 focus-within:shadow-md"
    >
      {/* Radix Select renders its own hidden input, so this one must NOT
          share the name — two fields would submit the value twice. */}
      {wilaya !== ALL_ALGERIA ? (
        <input type="hidden" name="wilaya_code" value={wilaya} />
      ) : null}

      <div className="flex flex-col md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            name="q"
            placeholder={t("searchPlaceholder")}
            className="h-12 border-0 bg-transparent ps-10 text-base shadow-none hover:border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
            aria-label={t("searchLabel")}
          />
        </div>

        <div className="mx-3 h-px bg-border md:mx-0 md:h-6 md:w-px" aria-hidden />

        <div className="relative md:w-52">
          <MapPin
            className="pointer-events-none absolute start-3.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Select value={wilaya} onValueChange={setWilaya}>
            <SelectTrigger
              className="h-12 border-0 bg-transparent ps-10 text-base shadow-none focus-visible:ring-inset focus-visible:ring-offset-0"
              aria-label={t("wilayaFilterLabel")}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_ALGERIA}>{tc("allAlgeria")}</SelectItem>
              {wilayasFor(locale).map((option) => (
                <SelectItem key={option.code} value={String(option.code)}>
                  {option.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button type="submit" size="lg" className="mt-1.5 md:mt-0 md:min-w-28">
          {tc("search")}
        </Button>
      </div>
    </form>
  );
}
