// app/dashboard/audits/[id]/page.tsx

import { redirect } from "next/navigation";

import { getCurrentUser } from "@/app/lib/auth";
import { isPaidSubscriber } from "@/app/lib/subscription";
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

  const canExport = await isPaidSubscriber(user.id);

  return <AuditReportClient auditId={id} canExport={canExport} />;
}