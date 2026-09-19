import { getCurrentUser } from "@/app/lib/auth";

/**
 * Returns the current user if they are an admin, otherwise null.
 *
 * An admin is any user whose `role` column is "admin".
 */
export async function getAdminUser() {
  const user = await getCurrentUser();

  if (!user) return null;

  if ((user as { role?: string }).role !== "admin") {
    return null;
  }

  return user;
}

export async function requireAdmin() {
  const admin = await getAdminUser();

  if (!admin) {
    // Not authorized — the caller should redirect or return 403
    return null;
  }

  return admin;
}