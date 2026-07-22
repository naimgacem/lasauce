import type { Metadata } from "next";

import { BrowseView } from "@/features/items/components/browse-view";

export const metadata: Metadata = { title: "Search" };

export default function SearchPage() {
  return (
    <BrowseView
      title="Search everything"
      description="Search across all lost and found reports in one place."
    />
  );
}
