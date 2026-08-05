import { Suspense } from "react";

import { FullPageLoader } from "@/components/feedback/loading";
import { Logo } from "@/components/layout/logo";
import { GuestGuard } from "@/features/auth/guards/guest-guard";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // Suspense: GuestGuard reads ?next= via useSearchParams.
    <Suspense fallback={<FullPageLoader />}>
      <GuestGuard>
        <div className="container flex min-h-screen flex-col items-center justify-center py-10">
          <div className="mb-8">
            <Logo className="text-lg" />
          </div>
          <div className="w-full max-w-md">{children}</div>
        </div>
      </GuestGuard>
    </Suspense>
  );
}
