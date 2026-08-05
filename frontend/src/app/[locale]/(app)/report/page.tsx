import type { Metadata } from "next";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";

import { FullPageLoader } from "@/components/feedback/loading";
import { ReportWizard } from "@/features/report/components/report-wizard";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("common");
  return { title: t("reportItem") };
}

export default function ReportPage() {
  return (
    // Suspense: the wizard reads ?type= via useSearchParams.
    <Suspense fallback={<FullPageLoader />}>
      <ReportWizard />
    </Suspense>
  );
}
