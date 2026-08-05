import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ItemDetailView } from "@/features/items/components/item-detail-view";
import { formatDate } from "@/lib/format";
import { serverEnv } from "@/lib/server-env";
import {
  absoluteMediaUrl,
  fetchItem,
  serverKnowsEveryItem,
} from "@/services/server/items";
import { localeAlternates } from "@/lib/metadata";
import { getTranslations } from "next-intl/server";
import { asLocale } from "@/i18n/routing";
import { wilayaName } from "@/lib/algeria-wilayas";

interface PageProps {
  params: Promise<{ id: string; locale: string }>;
}

/**
 * Link previews are the growth surface for this product: reports get shared in
 * WhatsApp groups, and a link with no card is a link nobody taps. This is also
 * what lets Google index an item at all — the previous client-only page served
 * crawlers an empty shell.
 */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id, locale } = await params;
  const item = await fetchItem(id);

  if (!item) {
    return { title: "Item not found", robots: { index: false, follow: false } };
  }

  const t = await getTranslations({ locale: asLocale(locale), namespace: "item" });
  const lost = item.type === "lost";
  const place = [wilayaName(item.wilaya_code, locale), item.location_text]
    .filter(Boolean)
    .join(", ");
  const title = t(lost ? "ogTitleLost" : "ogTitleFound", { title: item.title });
  const description = [
    place
      ? t(lost ? "ogPlaceLost" : "ogPlaceFound", { place })
      : t(lost ? "lostBadge" : "foundBadge"),
    formatDate(item.lost_or_found_at, locale),
    item.description,
  ]
    .filter(Boolean)
    .join(" · ")
    .slice(0, 200);

  const image = absoluteMediaUrl(item.images?.[0]?.image_path);
  const url = `${serverEnv.siteUrl}/${locale}/items/${item.id}`;

  return {
    title,
    description,
    alternates: localeAlternates(locale, `/items/${item.id}`),
    openGraph: {
      type: "article",
      title,
      description,
      url,
      images: image ? [{ url: image, alt: item.title }] : undefined,
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title,
      description,
      images: image ? [image] : undefined,
    },
    // A closed report is no longer actionable — keep it reachable by link but
    // out of the index so search results only ever surface live reports.
    robots: item.status === "closed" ? { index: false, follow: true } : undefined,
  };
}

export default async function ItemDetailPage({ params }: PageProps) {
  const { id } = await params;
  const item = await fetchItem(id);
  // Real 404 status, not a 200 carrying an error message — crawlers and the
  // browser both need to know this page doesn't exist. Only the server can say
  // so, though: in mock mode it doesn't hold the whole dataset, so it defers to
  // the client instead of 404-ing an item that is really there.
  if (!item && serverKnowsEveryItem) notFound();

  return <ItemDetailView itemId={id} initialItem={item ?? undefined} />;
}
