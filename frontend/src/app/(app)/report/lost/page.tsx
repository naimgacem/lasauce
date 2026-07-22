import { redirect } from "next/navigation";

export default function ReportLostRedirect() {
  redirect("/report?type=lost");
}
