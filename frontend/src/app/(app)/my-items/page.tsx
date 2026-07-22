import type { Metadata } from "next";

import { ComingSoon } from "@/components/feedback/coming-soon";

export const metadata: Metadata = { title: "My items" };

export default function MyItemsPage() {
  return <ComingSoon title="My items" />;
}
