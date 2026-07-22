"use client";

import { m } from "framer-motion";

import { listContainer, listItem } from "@/animations";
import { FullPageLoader } from "@/components/feedback/loading";
import { PageHeader } from "@/components/shared/page-header";
import { useSession } from "@/features/auth/hooks/use-session";
import { PreferencesCard } from "@/features/profile/components/preferences-card";
import { ProfileForm } from "@/features/profile/components/profile-form";
import { SecurityCard } from "@/features/profile/components/security-card";

export default function ProfilePage() {
  const { user } = useSession();

  if (!user) return <FullPageLoader />;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="Profile"
        description="Your account, security and preferences."
      />
      <m.div
        variants={listContainer}
        initial="initial"
        animate="enter"
        className="space-y-6"
      >
        <m.div variants={listItem}>
          <ProfileForm user={user} />
        </m.div>
        <m.div variants={listItem}>
          <SecurityCard user={user} />
        </m.div>
        <m.div variants={listItem}>
          <PreferencesCard />
        </m.div>
      </m.div>
    </div>
  );
}
