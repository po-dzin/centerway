import { redirect } from "next/navigation";

export default function LegacyAuditRedirectPage() {
    redirect("/admin/system/audit");
}
