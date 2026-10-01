import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { asLocale } from "@/i18n/routing";

type PageKey = "overview" | "users" | "user" | "items" | "item" | "matches" | "payments" | "activity";

/**
 * Browser-tab title for a console page: "Users · Admin · sabtou".
 *
 * Absolute rather than left to the layout's `title.template`: Next applies a
 * template only to *child* segments, and the overview is the admin layout's
 * own segment — through the template it would lose the "Admin" part and read
 * like a page of the public site.
 */
export async function adminPageMetadata(
  params: Promise<{ locale: string }>,
  page: PageKey,
): Promise<Metadata> {
  const locale = asLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: "admin.meta" });
  const site = (await getTranslations({ locale, namespace: "meta" }))("siteName");
  return { title: { absolute: `${t(page)} · ${t("section")} · ${site}` } };
}
