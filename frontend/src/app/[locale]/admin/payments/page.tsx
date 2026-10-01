import { adminPageMetadata } from "@/features/admin/metadata";
import { PaymentsView } from "@/features/admin/views/payments-view";

type Props = { params: Promise<{ locale: string }> };

export function generateMetadata({ params }: Props) {
  return adminPageMetadata(params, "payments");
}

export default function AdminPaymentsPage() {
  return <PaymentsView />;
}
