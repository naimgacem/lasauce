import type { Metadata } from "next";
import { Suspense } from "react";

import { FullPageLoader } from "@/components/feedback/loading";
import { ReportWizard } from "@/features/report/components/report-wizard";

export const metadata: Metadata = { title: "Report an item" };

export default function ReportPage() {
  return (
    // Suspense: the wizard reads ?type= via useSearchParams.
    <Suspense fallback={<FullPageLoader />}>
      <ReportWizard />
    </Suspense>
  );
}
