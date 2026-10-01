import { adminPageMetadata } from "@/features/admin/metadata";
import { MatchesView } from "@/features/admin/views/matches-view";

type Props = { params: Promise<{ locale: string }> };

export function generateMetadata({ params }: Props) {
  return adminPageMetadata(params, "matches");
}

export default function AdminMatchesPage() {
  return <MatchesView />;
}
