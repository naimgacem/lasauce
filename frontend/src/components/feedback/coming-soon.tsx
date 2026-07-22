import { Hammer } from "lucide-react";

import { EmptyState } from "@/components/feedback/empty-state";
import { PageHeader } from "@/components/shared/page-header";

/** Stub surface for routes whose business UI ships in a later build step. */
export function ComingSoon({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="space-y-6">
      <PageHeader title={title} />
      <EmptyState
        icon={Hammer}
        title="This screen is on its way"
        description={
          description ??
          "The foundation is in place — this page's UI ships in the next build step."
        }
      />
    </div>
  );
}
