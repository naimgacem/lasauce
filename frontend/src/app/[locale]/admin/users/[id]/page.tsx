import { adminPageMetadata } from "@/features/admin/metadata";
import { UserDetailView } from "@/features/admin/views/user-detail-view";

type Props = { params: Promise<{ locale: string; id: string }> };

export function generateMetadata({ params }: Props) {
  return adminPageMetadata(params, "user");
}

export default async function AdminUserPage({ params }: Props) {
  const { id } = await params;
  return <UserDetailView userId={id} />;
}
