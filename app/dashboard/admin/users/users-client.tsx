"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

/* =========================================================
   TYPES
========================================================= */

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  emailVerifiedAt: Date | null;
  createdAt: Date;
};

type Props = {
  users: UserRow[];
};

/* =========================================================
   HELPERS
========================================================= */

function formatDate(date: Date | null | undefined) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/* =========================================================
   COMPONENT
========================================================= */

export default function UsersClient({ users }: Props) {
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "user" | "admin">(
    "all"
  );
  const [verifiedFilter, setVerifiedFilter] = useState<
    "all" | "verified" | "pending"
  >("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    return users.filter((u) => {
      if (q) {
        const haystack = `${u.name} ${u.email}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      if (roleFilter !== "all" && u.role !== roleFilter) return false;

      if (verifiedFilter === "verified" && !u.emailVerifiedAt) return false;
      if (verifiedFilter === "pending" && u.emailVerifiedAt) return false;

      return true;
    });
  }, [users, query, roleFilter, verifiedFilter]);

  const isFiltering =
    query.trim() !== "" ||
    roleFilter !== "all" ||
    verifiedFilter !== "all";

  function clearFilters() {
    setQuery("");
    setRoleFilter("all");
    setVerifiedFilter("all");
  }

  /* ---------- Export ---------- */

  function handleExport(format: "csv" | "pdf") {
    // Pass current filters to the export route so the file matches
    // what the admin is seeing. Simple approach: only for pdf we
    // keep it unfiltered (full report); csv also unfiltered.
    //
    // If you want filtered exports, add ?q=...&role=... to the URL
    // and handle them in the API route.
    window.open(`/api/admin/users/export?format=${format}`, "_blank");
  }

  return (
    <div className="flex flex-col gap-6">
      {/* ---------- Header ---------- */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="eyebrow mb-1">Admin</div>
          <h1 className="page-title">Users</h1>
          <p className="page-subtitle">
            {filtered.length} of {users.length} user
            {users.length === 1 ? "" : "s"}
            {isFiltering ? " matching filters" : ""}.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => handleExport("csv")}
            className="btn-stripe btn-stripe-secondary"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            CSV
          </button>

          <button
            type="button"
            onClick={() => handleExport("pdf")}
            className="btn-stripe btn-stripe-secondary"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M6 2h9l6 6v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="9" y1="15" x2="15" y2="15" />
              <line x1="9" y1="18" x2="15" y2="18" />
            </svg>
            PDF
          </button>
        </div>
      </div>

      {/* ---------- Search + Filters ---------- */}
      <section className="stripe-panel">
        <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center">
          {/* Search */}
          <div className="relative flex-1">
            <span
              className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3"
              style={{ color: "var(--text-subtle)" }}
              aria-hidden="true"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </span>

            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or email..."
              className="stripe-input"
              style={{ paddingLeft: 36 }}
              aria-label="Search users"
            />
          </div>

          {/* Role filter */}
          <select
            value={roleFilter}
            onChange={(e) =>
              setRoleFilter(e.target.value as typeof roleFilter)
            }
            className="stripe-input sm:max-w-[160px]"
            aria-label="Filter by role"
          >
            <option value="all">All roles</option>
            <option value="user">Users</option>
            <option value="admin">Admins</option>
          </select>

          {/* Verified filter */}
          <select
            value={verifiedFilter}
            onChange={(e) =>
              setVerifiedFilter(e.target.value as typeof verifiedFilter)
            }
            className="stripe-input sm:max-w-[160px]"
            aria-label="Filter by verification"
          >
            <option value="all">All verification</option>
            <option value="verified">Verified</option>
            <option value="pending">Pending</option>
          </select>

          {isFiltering && (
            <button
              type="button"
              onClick={clearFilters}
              className="btn-stripe btn-stripe-ghost shrink-0"
            >
              Clear
            </button>
          )}
        </div>
      </section>

      {/* ---------- Table ---------- */}
      <section className="stripe-panel overflow-hidden">
        <div
          className="stripe-table-wrapper"
          style={{ border: 0, borderRadius: 0 }}
        >
          <table className="stripe-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Verified</th>
                <th>Joined</th>
                <th style={{ textAlign: "right" }} aria-label="Actions" />
              </tr>
            </thead>

            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center">
                    <p
                      className="text-sm"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {isFiltering
                        ? "No users match your filters."
                        : "No users found."}
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <span
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                          style={{
                            background:
                              "linear-gradient(135deg, #fff7ed 0%, #fed7aa 100%)",
                            color: "#c2410c",
                          }}
                        >
                          {user.name.charAt(0).toUpperCase()}
                        </span>
                        <div className="min-w-0">
                          <div
                            className="truncate text-sm font-semibold"
                            style={{ color: "var(--text-primary)" }}
                          >
                            {user.name}
                          </div>
                          <div
                            className="truncate text-xs"
                            style={{ color: "var(--text-subtle)" }}
                          >
                            {user.email}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td>
                      <span
                        className={`stripe-badge ${
                          user.role === "admin"
                            ? "stripe-badge-info"
                            : "stripe-badge-neutral"
                        }`}
                      >
                        {user.role}
                      </span>
                    </td>

                    <td>
                      {user.emailVerifiedAt ? (
                        <span
                          className="text-xs"
                          style={{ color: "var(--success)" }}
                        >
                          ✓ Verified
                        </span>
                      ) : (
                        <span
                          className="text-xs"
                          style={{ color: "var(--text-subtle)" }}
                        >
                          Pending
                        </span>
                      )}
                    </td>

                    <td>
                      <span
                        className="text-xs"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        {formatDate(user.createdAt)}
                      </span>
                    </td>

                    <td style={{ textAlign: "right" }}>
                      <Link
                        href={`/dashboard/admin/users/${user.id}`}
                        className="btn-stripe btn-stripe-secondary"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}