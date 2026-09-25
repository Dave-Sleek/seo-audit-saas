// app/dashboard/projects/[id]/page.tsx

import { notFound, redirect } from "next/navigation";

import { getCurrentUser } from "@/app/lib/auth";
import { getProjectAccess } from "@/app/lib/project-access";
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

  /* ---------- Owner OR accepted collaborator ---------- */

  const access = await getProjectAccess(user.id, id);

  if (!access) {
    notFound();
  }

  return (
    <ProjectAuditHistory
      projectId={id}
      role={access.role}
    />
  );
}