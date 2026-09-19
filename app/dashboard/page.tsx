import { redirect } from "next/navigation";

import { getCurrentUser } from "@/app/lib/auth";
import { getUsageSummary } from "@/app/lib/usage";
import DashboardClient from "./dashboard-client";

export default async function DashboardPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const usage = await getUsageSummary(user.id);

  const hasSubscription = Boolean(usage.subscription && usage.plan);
  const auditsUsed = usage.usage?.auditsUsed ?? 0;
  const auditLimit = usage.limits.audits;
  const auditsRemaining = Math.max(0, auditLimit - auditsUsed);
  const canRunAudit = hasSubscription && auditsRemaining > 0;

  return (
    <DashboardClient
      user={{
        id: user.id,
        name: user.name ?? null,
        email: user.email,
      }}
      subscription={{
        hasSubscription,
        canRunAudit,
        auditsUsed,
        auditLimit,
        auditsRemaining,
        planName: usage.plan?.name ?? null,
      }}
    />
  );
}