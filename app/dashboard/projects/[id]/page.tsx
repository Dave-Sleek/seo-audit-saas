import { redirect } from "next/navigation";

import { getCurrentUser } from "@/app/lib/auth";
import ProjectAuditHistory from "./project-audit-history";

export default async function ProjectPage({
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
    <ProjectAuditHistory projectId={id} />
  );
}