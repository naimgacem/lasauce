import { adminPageMetadata } from "@/features/admin/metadata";
import { ActivityView } from "@/features/admin/views/activity-view";

type Props = { params: Promise<{ locale: string }> };

export function generateMetadata({ params }: Props) {
  return adminPageMetadata(params, "activity");
}

export default function AdminActivityPage() {
  return <ActivityView />;
}
