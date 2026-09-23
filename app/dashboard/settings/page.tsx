import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";

import { getCurrentUser } from "@/app/lib/auth";
import { db } from "@/app/db";
import { users } from "@/app/db/schema";
import SettingsClient from "./[id]/settings-client";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const sessionUser = await getCurrentUser();

  if (!sessionUser) {
    redirect("/login");
  }

  const [row] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      twoFactorEnabledAt: users.twoFactorEnabledAt,
      twoFactorMethod: users.twoFactorMethod,
    })
    .from(users)
    .where(eq(users.id, sessionUser.id))
    .limit(1);

  if (!row) {
    redirect("/login");
  }

  return (
    <SettingsClient
      user={{
        id: row.id,
        name: row.name ?? "",
        email: row.email,
        twoFactorEnabledAt: row.twoFactorEnabledAt
          ? row.twoFactorEnabledAt.toISOString()
          : null,
        twoFactorMethod:
          row.twoFactorMethod === "email" || row.twoFactorMethod === "totp"
            ? row.twoFactorMethod
            : null,
      }}
    />
  );
}