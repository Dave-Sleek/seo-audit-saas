import { redirect } from "next/navigation";

import { getCurrentUser } from "@/app/lib/auth";
import AuditReportClient from "./audit-report-client";

export default async function AuditReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const { id } = await params;

  return (
    <AuditReportClient auditId={id} />
  );
}

