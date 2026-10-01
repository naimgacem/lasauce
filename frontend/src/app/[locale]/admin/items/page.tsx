import { adminPageMetadata } from "@/features/admin/metadata";
import { ItemsView } from "@/features/admin/views/items-view";

type Props = { params: Promise<{ locale: string }> };

export function generateMetadata({ params }: Props) {
  return adminPageMetadata(params, "items");
}

export default function AdminItemsPage() {
  return <ItemsView />;
}
