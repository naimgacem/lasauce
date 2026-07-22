import type { Metadata } from "next";

import { BrowseView } from "@/features/items/components/browse-view";

export const metadata: Metadata = { title: "Found items" };

export default function BrowseFoundPage() {
  return (
    <BrowseView
      presetType="found"
      title="Found items"
      description="Things waiting to be claimed. Lost something? It might already be here."
    />
  );
}
