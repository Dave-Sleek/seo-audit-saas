// app/lib/support-admins.ts

import { eq } from "drizzle-orm";

import { db } from "@/app/db";
import { users } from "@/app/db/schema";

/**
 * Returns the email addresses of users with role === "admin".
 */
export async function getSupportAdminEmails(): Promise<string[]> {
  const rows = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.role, "admin"));

  return rows
    .map((r) => r.email)
    .filter((email): email is string => Boolean(email));
}