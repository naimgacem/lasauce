import { AppHeader } from "@/components/layout/app-header";
import { MobileTabBar } from "@/components/layout/mobile-tab-bar";
import { AuthGuard } from "@/features/auth/guards/auth-guard";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <div className="flex min-h-screen flex-col">
        <AppHeader />
        {/* pb clearance for the mobile tab bar */}
        <main className="container max-w-5xl flex-1 py-6 pb-28 md:py-8 lg:pb-8">
          {children}
        </main>
        <MobileTabBar />
      </div>
    </AuthGuard>
  );
}
