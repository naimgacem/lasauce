import type { Metadata } from "next";

import { BrowseView } from "@/features/items/components/browse-view";

export const metadata: Metadata = { title: "Lost items" };

export default function BrowseLostPage() {
  return (
    <BrowseView
      presetType="lost"
      title="Lost items"
      description="Things people are looking for. Recognise something? Open it and get in touch."
    />
  );
}
