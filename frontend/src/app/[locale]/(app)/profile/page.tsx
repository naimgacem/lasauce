"use client";

import { useTranslations } from "next-intl";

import { FullPageLoader } from "@/components/feedback/loading";
import { PageHeader } from "@/components/shared/page-header";
import { useSession } from "@/features/auth/hooks/use-session";
import { PreferencesCard } from "@/features/profile/components/preferences-card";
import { ProfileForm } from "@/features/profile/components/profile-form";
import { SecurityCard } from "@/features/profile/components/security-card";

export default function ProfilePage() {
  const t = useTranslations("profile");
  const { user } = useSession();

  if (!user) return <FullPageLoader />;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title={t("title")}
        description={t("description")}
      />
      <ProfileForm user={user} />
      <SecurityCard user={user} />
      <PreferencesCard />
    </div>
  );
}
