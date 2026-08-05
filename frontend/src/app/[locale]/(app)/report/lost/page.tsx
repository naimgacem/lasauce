import { redirect } from "@/i18n/navigation";
import { asLocale } from "@/i18n/routing";

/** Convenience entry point — `/report/lost` opens the wizard pre-set to "lost". */
export default async function ReportLostRedirect({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  redirect({ href: "/report?type=lost", locale: asLocale((await params).locale) });
}
