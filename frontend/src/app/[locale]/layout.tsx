import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { GeistSans } from "geist/font/sans";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { asLocale, dirFor, routing } from "@/i18n/routing";
import { serverEnv } from "@/lib/server-env";
import { AppProviders } from "@/providers/app-providers";
import "@/styles/globals.css";

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
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafaf9" },
    { media: "(prefers-color-scheme: dark)", color: "#0c0a09" },
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

  return (
    <html
      lang={locale}
      dir={dirFor(locale)}
      suppressHydrationWarning
      className={GeistSans.variable}
    >
      <body className="min-h-screen bg-background font-sans">
        <NextIntlClientProvider>
          <AppProviders>{children}</AppProviders>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
