"use client";

import { Link } from "@/i18n/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { m } from "framer-motion";
import {
  ArrowRight,
  FileText,
  Handshake,
  MapPin,
  Search,
  ShieldCheck,
  ScanSearch,
} from "lucide-react";

import { listContainer, listItem, revealOnce, revealUp } from "@/animations";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RecentItemsStrip } from "@/features/items/components/recent-items-strip";
import { wilayasFor } from "@/lib/algeria-wilayas";
import { loginWithNext, ROUTES } from "@/lib/routes";

const STEP_ICONS = [FileText, ScanSearch, Handshake] as const;

const ALL_ALGERIA = "all";

export default function LandingPage() {
  const t = useTranslations("landing");
  const tc = useTranslations("common");
  const ti = useTranslations("item");
  const locale = useLocale();
  const [wilaya, setWilaya] = useState(ALL_ALGERIA);

  const steps = [1, 2, 3].map((n, i) => ({
    icon: STEP_ICONS[i],
    title: t(`step${n}Title` as "step1Title"),
    body: t(`step${n}Body` as "step1Body"),
    ai: n === 2,
  }));

  return (
    <>
      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        {/* Soft brand aura. Decorative only — sits behind everything. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -top-40 h-[420px] bg-[radial-gradient(60%_60%_at_50%_50%,hsl(var(--primary)/0.10),transparent_70%)]"
        />

        <m.div
          variants={listContainer}
          initial="initial"
          animate="enter"
          className="container relative flex flex-col items-center gap-6 py-section text-center md:py-section-lg"
        >
          <m.div variants={listItem}>
            <Badge variant="premium" className="px-3 py-1">
              {t("aiBadge")}
            </Badge>
          </m.div>

          <m.h1 variants={listItem} className="max-w-3xl text-display">
            {t("heroTitle")}
            <br />
            <span className="text-primary">{t("heroHighlight")}</span>
          </m.h1>

          <m.p
            variants={listItem}
            className="max-w-xl text-balance text-body-lg text-muted-foreground"
          >
            {t("heroSubtitle")}
          </m.p>

          {/* Search card */}
          <m.div variants={listItem} className="w-full max-w-3xl space-y-4">
            <form
              action={ROUTES.search}
              className="group overflow-hidden rounded-2xl border bg-card shadow-lg transition-shadow duration-300 focus-within:shadow-xl md:p-1.5"
            >
              {/* Radix Select renders its own hidden input, so this one must NOT
                  share the name — two fields would submit the value twice. */}
              {wilaya !== ALL_ALGERIA ? (
                <input type="hidden" name="wilaya_code" value={wilaya} />
              ) : null}

              <div className="flex flex-col gap-1.5 md:flex-row md:items-center">
                <div className="relative flex-1 md:border-e md:border-border/70">
                  <Search
                    className="pointer-events-none absolute start-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden
                  />
                  <Input
                    type="search"
                    name="q"
                    placeholder={t("searchPlaceholder")}
                    className="h-14 border-0 bg-transparent ps-11 text-base shadow-none hover:border-0 focus-visible:border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                    aria-label={t("searchLabel")}
                  />
                </div>

                <div className="relative md:w-[240px]">
                  <MapPin
                    className="pointer-events-none absolute start-4 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden
                  />
                  <Select value={wilaya} onValueChange={setWilaya}>
                    <SelectTrigger
                      className="h-14 border-0 bg-transparent ps-10 text-base shadow-none focus:ring-0 focus:ring-offset-0"
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

                <Button
                  type="submit"
                  size="xl"
                  className="m-1.5 md:m-0 md:me-1 md:min-w-[132px]"
                >
                  {tc("search")}
                </Button>
              </div>
            </form>

            <div className="flex flex-wrap items-center justify-center gap-3">
              <Button size="lg" asChild>
                <Link href={loginWithNext(ROUTES.reportFound)}>
                  {t("postFound")}
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href={loginWithNext(ROUTES.reportLost)}>
                  {t("reportLost")}
                </Link>
              </Button>
            </div>

            <p className="flex items-center justify-center gap-2 text-caption text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
              {t("privacyNote")}
            </p>
          </m.div>
        </m.div>
      </section>

      {/* ── Recently reported ───────────────────────────────────────────── */}
      <RecentItemsStrip />

      {/* ── How it works ────────────────────────────────────────────────── */}
      <section className="border-t" aria-labelledby="how-it-works">
        <div className="container py-section md:py-section-lg">
          <m.h2
            {...revealOnce}
            variants={revealUp}
            id="how-it-works"
            className="text-center text-heading-2"
          >
            {t("howItWorks")}
          </m.h2>

          <m.ol
            variants={listContainer}
            initial="initial"
            whileInView="enter"
            viewport={{ once: true, margin: "-60px" }}
            className="mt-block grid gap-stack-lg md:grid-cols-3"
          >
            {steps.map((step, i) => (
              <m.li
                key={step.title}
                variants={listItem}
                className="group relative flex flex-col items-center gap-3 text-center"
              >
                {/* Connector between steps on desktop. */}
                {i < steps.length - 1 ? (
                  <span
                    aria-hidden
                    className="absolute start-[calc(50%+2.25rem)] end-[calc(-50%+2.25rem)] top-7 hidden h-px bg-gradient-to-r from-border to-transparent md:block"
                  />
                ) : null}

                <span
                  className={
                    step.ai
                      ? "relative flex h-14 w-14 items-center justify-center rounded-2xl bg-premium-gradient text-premium-foreground shadow-md transition-transform duration-300 ease-out group-hover:scale-105"
                      : "relative flex h-14 w-14 items-center justify-center rounded-2xl border bg-card text-primary shadow-sm transition-transform duration-300 ease-out group-hover:scale-105"
                  }
                >
                  <step.icon className="h-6 w-6" aria-hidden />
                  <span className="absolute -end-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-foreground text-[10px] font-bold text-background">
                    {i + 1}
                  </span>
                </span>

                <h3 className="text-heading-4">{step.title}</h3>
                <p className="max-w-xs text-body-sm text-muted-foreground">
                  {step.body}
                </p>
              </m.li>
            ))}
          </m.ol>

          <m.div {...revealOnce} variants={revealUp} className="mt-block text-center">
            <Button variant="ghost" asChild>
              <Link href={ROUTES.lost}>
                {ti("browseLost")}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </m.div>
        </div>
      </section>
    </>
  );
}
