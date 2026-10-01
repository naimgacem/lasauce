import { adminPageMetadata } from "@/features/admin/metadata";
import { OverviewView } from "@/features/admin/views/overview-view";

type Props = { params: Promise<{ locale: string }> };

export function generateMetadata({ params }: Props) {
  return adminPageMetadata(params, "overview");
}

export default function AdminOverviewPage() {
  return <OverviewView />;
}
