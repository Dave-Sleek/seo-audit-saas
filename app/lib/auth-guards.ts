import { redirect } from "next/navigation";

import { getCurrentUser } from "@/app/lib/auth";

/**
 * Use this in server components under /dashboard/* to require
 * a verified, authenticated user.
 *
 * Redirects:
 *   - unauthenticated → /login
 *   - unverified      → /verify-email
 *
 * Returns the full user object (with emailVerifiedAt) so
 * callers don't need to re-fetch.
 */
export async function requireVerifiedUser() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (!user.emailVerifiedAt) {
    redirect("/verify-email");
  }

  return user;
}

/**
 * Use this in server components that only need an
 * authenticated user, regardless of verification state.
 * Currently unused, but useful for pages like
 * /verify-email itself.
 */
export async function requireUser() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}