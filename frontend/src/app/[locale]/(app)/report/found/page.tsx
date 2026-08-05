import { redirect } from "@/i18n/navigation";
import { asLocale } from "@/i18n/routing";

/** Convenience entry point — `/report/found` opens the wizard pre-set to "found". */
export default async function ReportFoundRedirect({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  redirect({ href: "/report?type=found", locale: asLocale((await params).locale) });
}
