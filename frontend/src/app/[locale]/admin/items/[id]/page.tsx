import { adminPageMetadata } from "@/features/admin/metadata";
import { ItemDetailView } from "@/features/admin/views/item-detail-view";

type Props = { params: Promise<{ locale: string; id: string }> };

export function generateMetadata({ params }: Props) {
  return adminPageMetadata(params, "item");
}

export default async function AdminItemPage({ params }: Props) {
  const { id } = await params;
  return <ItemDetailView itemId={id} />;
}
