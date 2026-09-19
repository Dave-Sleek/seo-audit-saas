import { desc } from "drizzle-orm";

import { db } from "@/app/db";
import { users } from "@/app/db/schema";

import UsersClient from "./users-client";

export default async function AdminUsersPage() {
  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      emailVerifiedAt: users.emailVerifiedAt,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(desc(users.createdAt))
    .limit(1000);

  return <UsersClient users={rows} />;
}