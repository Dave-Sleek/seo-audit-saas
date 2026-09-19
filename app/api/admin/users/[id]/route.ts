import { NextResponse } from "next/server";
import { and, count, eq, ne } from "drizzle-orm";

import { db } from "@/app/db";
import {
  users,
  subscriptions,
  projects,
  audits,
  payments,
} from "@/app/db/schema";
import { getCurrentUser } from "@/app/lib/auth";

/* =========================================================
   AUTH GUARD
========================================================= */

async function checkAdmin() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 }
    );
  }

  if (user.role !== "admin") {
    return NextResponse.json(
      { error: "Administrator access required." },
      { status: 403 }
    );
  }

  return user;
}

/* =========================================================
   GET /api/admin/users/:id
========================================================= */

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await checkAdmin();
    if (admin instanceof NextResponse) return admin;

    const { id } = await context.params;

    /* ---------- Load user ---------- */

    const [user] = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        emailVerifiedAt: users.emailVerifiedAt,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    if (!user) {
      return NextResponse.json(
        { error: "User not found." },
        { status: 404 }
      );
    }

    /* ---------- Load subscription (latest) ---------- */

    const [subscription] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, id))
      .limit(1);

    /* ---------- Count projects ---------- */

    const [projectCountRow] = await db
      .select({ value: count() })
      .from(projects)
      .where(eq(projects.userId, id));

    /* ---------- Count audits (through projects) ---------- */

    const [auditCountRow] = await db
      .select({ value: count() })
      .from(audits)
      .innerJoin(projects, eq(audits.projectId, projects.id))
      .where(eq(projects.userId, id));

    /* ---------- Count payments ---------- */

    const [paymentCountRow] = await db
      .select({ value: count() })
      .from(payments)
      .where(eq(payments.userId, id));

    return NextResponse.json({
      success: true,
      user,
      subscription: subscription ?? null,
      stats: {
        projects: Number(projectCountRow?.value ?? 0),
        audits: Number(auditCountRow?.value ?? 0),
        payments: Number(paymentCountRow?.value ?? 0),
      },
    });
  } catch (error) {
    console.error("Admin user GET error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to load user.",
      },
      { status: 500 }
    );
  }
}

/* =========================================================
   PATCH /api/admin/users/:id
   Update name, email, role, or verified status.
========================================================= */

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await checkAdmin();
    if (admin instanceof NextResponse) return admin;

    const { id } = await context.params;

    const [existing] = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json(
        { error: "User not found." },
        { status: 404 }
      );
    }

    const body = await request.json();

    /* ---------- Field extraction ---------- */

    const name =
      body.name !== undefined
        ? String(body.name).trim()
        : existing.name;

    const email =
      body.email !== undefined
        ? String(body.email).trim().toLowerCase()
        : existing.email;

    const role =
      body.role !== undefined
        ? String(body.role).trim().toLowerCase()
        : existing.role;

    const emailVerifiedAt =
      body.emailVerifiedAt !== undefined
        ? body.emailVerifiedAt === null
          ? null
          : new Date(String(body.emailVerifiedAt))
        : existing.emailVerifiedAt;

    /* ---------- Validation ---------- */

    if (!name) {
      return NextResponse.json(
        { error: "Name is required." },
        { status: 400 }
      );
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: "Please provide a valid email address." },
        { status: 400 }
      );
    }

    if (!["user", "admin"].includes(role)) {
      return NextResponse.json(
        { error: "Role must be 'user' or 'admin'." },
        { status: 400 }
      );
    }

    /* ---------- Prevent self-demotion ---------- */

    if (id === admin.id && role !== "admin") {
      return NextResponse.json(
        { error: "You cannot remove your own admin access." },
        { status: 400 }
      );
    }

    /* ---------- Prevent removing the last admin ---------- */

    if (role !== "admin") {
      const otherAdmins = await db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.role, "admin"), ne(users.id, id)));

      if (otherAdmins.length === 0) {
        return NextResponse.json(
          {
            error:
              "Cannot demote the last admin. Promote another user first.",
          },
          { status: 400 }
        );
      }
    }

    /* ---------- Email uniqueness ---------- */

    if (email !== existing.email) {
      const [dup] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (dup && dup.id !== id) {
        return NextResponse.json(
          { error: "That email is already in use." },
          { status: 409 }
        );
      }
    }

    /* ---------- Update ---------- */

    const [updated] = await db
      .update(users)
      .set({
        name,
        email,
        role,
        emailVerifiedAt,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        emailVerifiedAt: users.emailVerifiedAt,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      });

    return NextResponse.json({ success: true, user: updated });
  } catch (error) {
    console.error("Admin user PATCH error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to update user.",
      },
      { status: 500 }
    );
  }
}

/* =========================================================
   DELETE /api/admin/users/:id
   Hard delete (cascades to sessions, projects, audits, subs).
========================================================= */

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await checkAdmin();
    if (admin instanceof NextResponse) return admin;

    const { id } = await context.params;

    /* ---------- Prevent self-deletion ---------- */

    if (id === admin.id) {
      return NextResponse.json(
        { error: "You cannot delete your own account." },
        { status: 400 }
      );
    }

    const [existing] = await db
      .select({ id: users.id, role: users.role })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json(
        { error: "User not found." },
        { status: 404 }
      );
    }

    /* ---------- Prevent deleting the last admin ---------- */

    if (existing.role === "admin") {
      const otherAdmins = await db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.role, "admin"), ne(users.id, id)));

      if (otherAdmins.length === 0) {
        return NextResponse.json(
          {
            error:
              "Cannot delete the last admin. Promote another user first.",
          },
          { status: 400 }
        );
      }
    }

    /* ---------- Delete ---------- */

    await db.delete(users).where(eq(users.id, id));

    return NextResponse.json({
      success: true,
      message: "User deleted.",
    });
  } catch (error) {
    console.error("Admin user DELETE error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to delete user.",
      },
      { status: 500 }
    );
  }
}