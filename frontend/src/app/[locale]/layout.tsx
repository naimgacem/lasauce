import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { IBM_Plex_Sans_Arabic } from "next/font/google";
import { GeistSans } from "geist/font/sans";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { asLocale, dirFor, routing } from "@/i18n/routing";
import { serverEnv } from "@/lib/server-env";
import { AppProviders } from "@/providers/app-providers";
import "@/styles/globals.css";

/**
 * Geist has no Arabic glyphs, so the `ar` locale sets Plex Sans Arabic instead
 * of letting the OS pick a fallback (in practice, Arial). Plex's Latin is IBM
 * Plex — a close companion to Geist — so mixed text on Arabic pages stays of a
 * piece. Applied by `html[lang="ar"]` in globals.css; other locales never
 * reference it, so they never download it — hence no preload.
 */
const plexArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-arabic",
  display: "swap",
  preload: false,
});

/**
 * Root layout. It lives under `[locale]` rather than at `app/` because the
 * `lang` and `dir` attributes depend on the active locale, and those have to be
 * on the very first `<html>` the browser sees — setting them later would flash
 * an Arabic page laid out left-to-right.
 */

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const locale = asLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: "meta" });

  return {
    // Resolves every relative URL in child metadata (Open Graph images above
    // all) to an absolute one — social crawlers reject relative paths.
    metadataBase: new URL(serverEnv.siteUrl),
    title: { default: t("siteName"), template: `%s · ${t("siteName")}` },
    description: t("description"),
    // Icons come from app/icon.svg and app/apple-icon.png (file conventions).
    openGraph: {
      siteName: t("siteName"),
      type: "website",
      locale,
    },
    twitter: { card: "summary_large_image" },
    // Tells search engines the same page exists in the other languages.
    alternates: {
      languages: Object.fromEntries(
        routing.locales.map((l) => [l, `${serverEnv.siteUrl}/${l}`]),
      ),
    },
  };
}

export const viewport: Viewport = {
  // The browser chrome should continue the page, so these are the
  // `--background` tokens from globals.css, not generic greys.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfbf9" },
    { media: "(prefers-color-scheme: dark)", color: "#0d1210" },
  ],
};

export default async function LocaleLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  // Opts this route into static rendering; without it every page becomes
  // dynamic the moment a translation is read.
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "nav" });

  return (
    <html
      lang={locale}
      dir={dirFor(locale)}
      suppressHydrationWarning
      className={`${GeistSans.variable} ${plexArabic.variable}`}
    >
      <body className="min-h-screen bg-background font-sans">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-3 focus:z-[60] focus:rounded-md focus:bg-foreground focus:px-3 focus:py-2 focus:text-body-sm focus:font-medium focus:text-background"
        >
          {t("skipToContent")}
        </a>
        <NextIntlClientProvider>
          <AppProviders>{children}</AppProviders>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
