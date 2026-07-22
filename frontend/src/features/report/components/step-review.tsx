"use client";

import Image from "next/image";
import { CalendarDays, MapPin, Palette, Sparkles, Tag } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import {
  flattenCategories,
  useCategories,
} from "@/features/categories/hooks/use-categories";
import { ItemTypeBadge } from "@/features/items/components/item-badges";
import type { LocalImage } from "@/features/report/components/step-images";
import { formatDate } from "@/lib/format";
import type { ReportDraft } from "@/store/draft.store";
import type { ItemType } from "@/types/item";

function Row({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Tag;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      <span className="w-24 shrink-0 text-xs text-muted-foreground">{label}</span>
      <span className="min-w-0 flex-1 truncate text-sm font-medium">{value}</span>
    </div>
  );
}

export function StepReview({
  draft,
  type,
  images,
}: {
  draft: Partial<ReportDraft>;
  type: ItemType;
  images: LocalImage[];
}) {
  const { data: categories } = useCategories();
  const categoryName = draft.category_id
    ? flattenCategories(categories).find((c) => c.id === draft.category_id)?.name
    : undefined;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1.5">
              <ItemTypeBadge type={type} />
              <h3 className="text-lg font-semibold">{draft.title}</h3>
            </div>
          </div>
          <p className="mt-3 whitespace-pre-line text-sm text-muted-foreground">
            {draft.description}
          </p>

          <dl className="mt-4 divide-y border-t">
            <Row
              icon={CalendarDays}
              label={type === "lost" ? "Date lost" : "Date found"}
              value={formatDate(draft.lost_or_found_at)}
            />
            <Row icon={Tag} label="Category" value={categoryName ?? "Uncategorised"} />
            {draft.location_text ? (
              <Row icon={MapPin} label="Location" value={draft.location_text} />
            ) : null}
            {draft.color ? (
              <Row icon={Palette} label="Color" value={draft.color} />
            ) : null}
            {draft.brand ? <Row icon={Tag} label="Brand" value={draft.brand} /> : null}
          </dl>

          {images.length > 0 ? (
            <div className="mt-4 flex gap-2" aria-label={`${images.length} photos selected`}>
              {images.map((img) => (
                <div key={img.id} className="relative h-14 w-14">
                  <Image
                    src={img.previewUrl}
                    alt=""
                    fill
                    sizes="56px"
                    className="rounded-lg object-cover"
                    unoptimized
                  />
                </div>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="flex items-start gap-2.5 rounded-xl border border-primary/20 bg-primary/5 p-3.5 text-xs">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
        <p className="text-foreground/80">
          Once published, the matching engine starts comparing this report
          against every {type === "lost" ? "found" : "lost"} item — you&apos;ll be
          notified when a likely match appears.
        </p>
      </div>
    </div>
  );
}
