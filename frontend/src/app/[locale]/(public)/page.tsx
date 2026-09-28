import { ArrowRight, ShieldCheck } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { HeroSearch } from "@/features/items/components/hero-search";
import { RecentItemsStrip } from "@/features/items/components/recent-items-strip";
import { Link } from "@/i18n/navigation";
import { asLocale } from "@/i18n/routing";
import { loginWithNext, ROUTES } from "@/lib/routes";

const STEPS = [1, 2, 3] as const;

/**
 * Landing. Two jobs, in order: let someone search right now, and show that the
 * registry is alive. Everything above the fold is server-rendered and static —
 * no entrance animation on the headline, so it paints with the HTML instead of
 * waiting for JavaScript.
 */
export default async function LandingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = asLocale((await params).locale);
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "landing" });

  return (
    <>
      <section className="border-b">
        <div className="container grid gap-12 py-12 md:py-20 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-end lg:gap-16 xl:grid-cols-[minmax(0,1fr)_22rem] xl:gap-24">
          <div>
            <h1 className="max-w-2xl text-display">
              <span className="block text-balance">{t("heroTitle")}</span>
              <span className="block text-balance text-primary">
                {t("heroHighlight")}
              </span>
            </h1>
            <p className="mt-5 max-w-xl text-body-lg text-muted-foreground">
              {t("heroSubtitle")}
            </p>

            {/* Wider than the copy above it: the placeholder is an example
                query, and truncating the example defeats it. */}
            <div className="mt-8 max-w-3xl">
              <HeroSearch />
            </div>

            {/* The two ways in besides searching. Links, not buttons: the
                search button is the one primary action on this screen. */}
            <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 text-body-sm font-medium">
              <Link
                href={loginWithNext(ROUTES.reportFound)}
                className="group inline-flex items-center gap-1.5 text-foreground underline-offset-4 hover:underline"
              >
                {t("postFound")}
                <ArrowRight
                  className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-hover:text-foreground ltr:group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5"
                  aria-hidden
                />
              </Link>
              <Link
                href={loginWithNext(ROUTES.reportLost)}
                className="group inline-flex items-center gap-1.5 text-foreground underline-offset-4 hover:underline"
              >
                {t("reportLost")}
                <ArrowRight
                  className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-hover:text-foreground ltr:group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5"
                  aria-hidden
                />
              </Link>
            </div>

            <p className="mt-6 flex items-start gap-2 text-caption font-normal text-muted-foreground">
              <ShieldCheck className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
              {t("privacyNote")}
            </p>
          </div>

          {/* How it works — three sentences don't need a section of their own.
              Sitting beside the search, they answer "what happens after I
              report?" at the moment someone is deciding whether to. */}
          <aside
            aria-labelledby="how-it-works"
            className="border-t pt-8 lg:border-s lg:border-t-0 lg:ps-10 lg:pt-0"
          >
            <h2
              id="how-it-works"
              className="text-overline uppercase text-muted-foreground"
            >
              {t("howItWorks")}
            </h2>
            <ol className="mt-5 space-y-5">
              {STEPS.map((n) => (
                <li key={n} className="grid grid-cols-[1.75rem_minmax(0,1fr)] gap-x-2">
                  <span
                    className="pt-px text-body-sm font-medium tabular-nums text-muted-foreground"
                    aria-hidden
                  >
                    {String(n).padStart(2, "0")}
                  </span>
                  <div>
                    <h3 className="text-body-sm font-semibold">
                      {t(`step${n}Title`)}
                    </h3>
                    <p className="mt-0.5 text-body-sm text-muted-foreground">
                      {t(`step${n}Body`)}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </aside>
        </div>
      </section>

      <RecentItemsStrip />
    </>
  );
}
