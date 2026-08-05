import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { BrowseView } from "@/features/items/components/browse-view";
import { asLocale } from "@/i18n/routing";
import { localeAlternates } from "@/lib/metadata";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = asLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: "browse" });
  const title = t("lostTitle");
  const description = t("lostDescription");
  const url = `/${locale}/lost`;
  return {
    title,
    description,
    alternates: localeAlternates(locale, "/lost"),
    openGraph: { title, description, url },
  };
}

export default async function BrowseLostPage({ params }: Props) {
  const locale = asLocale((await params).locale);
  // Keeps this route statically prerenderable per locale.
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "browse" });

  return (
    <BrowseView
      presetType="lost"
      title={t("lostTitle")}
      description={t("lostDescription")}
    />
  );
}
