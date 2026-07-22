import { redirect } from "next/navigation";

export default function ReportFoundRedirect() {
  redirect("/report?type=found");
}
