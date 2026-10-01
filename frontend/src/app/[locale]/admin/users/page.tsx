import { adminPageMetadata } from "@/features/admin/metadata";
import { UsersView } from "@/features/admin/views/users-view";

type Props = { params: Promise<{ locale: string }> };

export function generateMetadata({ params }: Props) {
  return adminPageMetadata(params, "users");
}

export default function AdminUsersPage() {
  return <UsersView />;
}
