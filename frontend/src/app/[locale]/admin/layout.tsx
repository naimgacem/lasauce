import type { Metadata } from "next";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";

import { FullPageLoader } from "@/components/feedback/loading";
import { AdminGuard } from "@/features/admin/components/admin-guard";
import { AdminShell } from "@/features/admin/components/admin-shell";
import { asLocale } from "@/i18n/routing";

type Props = { children: React.ReactNode; params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = asLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: "admin.meta" });
  return {
    //  Pages set absolute titles (see `adminPageMetadata`); this covers any
    //  console route that does not, and the root template adds the site name.
    title: t("section"),
    //  Nothing here is for search engines, and the page shells alone would
    //  describe the console's capabilities to anyone indexing them.
    robots: { index: false, follow: false },
  };
}

/**
 * The admin console. Outside the `(app)` group on purpose: it has its own
 * frame, and a non-admin must not see that frame at all — the guard runs
 * before the shell renders.
 */
export default function AdminLayout({ children }: Props) {
  return (
    <AdminGuard>
      <AdminShell>
        {/* The views read their filters from the URL (`useSearchParams`). */}
        <Suspense fallback={<FullPageLoader />}>{children}</Suspense>
      </AdminShell>
    </AdminGuard>
  );
}
