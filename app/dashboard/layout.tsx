// app/dashboard/layout.tsx

import Link from "next/link";

import AccountMenu from "@/app/components/ui/account-menu";
import LogoutButton from "@/app/components/ui/logout-button";
import { requireVerifiedUser } from "@/app/lib/auth-guards";

/* =========================================================
   LAYOUT
========================================================= */

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireVerifiedUser();

  return (
    <div className="app-shell flex">
      {/* ============================================
          SIDEBAR
      ============================================ */}
      <aside className="dashboard-sidebar hidden lg:flex lg:flex-col">
        {/* Brand */}
        <div
          className="flex items-center px-5"
          style={{ height: "var(--header-height)" }}
        >
          <Link
            href="/dashboard"
            className="text-base font-bold tracking-tight"
            style={{ color: "var(--text-primary)" }}
          >
            NARANIO
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4">
          <NavLink href="/dashboard" icon={<DashboardIcon />}>
            Dashboard
          </NavLink>

          <NavLink href="/dashboard/projects" icon={<FolderIcon />}>
            Projects
          </NavLink>

          {/* 👇 NEW */}
          <NavLink href="/dashboard/team" icon={<TeamIcon />}>
            Team
          </NavLink>

          <NavLink href="/dashboard/audits" icon={<SearchIcon />}>
            Audits
          </NavLink>

          <NavLink href="/dashboard/subscription" icon={<CardIcon />}>
            Subscription
          </NavLink>

          <NavLink href="/dashboard/profile" icon={<UserIcon />}>
            Profile
          </NavLink>

          <NavLink href="/dashboard/settings" icon={<SettingsIcon />}>
            Settings
          </NavLink>

          <NavLink href="/dashboard/settings/activity" icon={<ActivityIcon />}>
            Recent activity
          </NavLink>

          <NavLink href="/dashboard/support" icon={<HelpIcon />}>
            Support
          </NavLink>
        </nav>

        {/* ---------- SIDEBAR FOOTER: user + logout ---------- */}
        <div
          className="border-t px-3 py-4"
          style={{ borderColor: "var(--border)" }}
        >
          <div className="mb-3 px-2">
            <p
              className="truncate text-sm font-semibold"
              style={{ color: "var(--text-primary)" }}
            >
              {user.name?.trim() || user.email.split("@")[0]}
            </p>
            <p
              className="truncate text-xs"
              style={{ color: "var(--text-muted)" }}
            >
              {user.email}
            </p>
          </div>

          <LogoutButton />
        </div>
      </aside>

      {/* ============================================
          MAIN COLUMN
      ============================================ */}
      <div className="app-main flex min-w-0 flex-1 flex-col">
        {/* ---------- HEADER ---------- */}
        <header className="dashboard-header">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="text-sm font-bold tracking-tight lg:hidden"
              style={{ color: "var(--text-primary)" }}
            >
              NARANIO
            </Link>
          </div>

          <AccountMenu
            user={{
              name: user.name ?? null,
              email: user.email,
            }}
          />
        </header>

        {/* ---------- PAGE CONTENT ---------- */}
        <main className="dashboard-content">{children}</main>
      </div>
    </div>
  );
}

/* =========================================================
   NAV LINK
========================================================= */

function NavLink({
  href,
  icon,
  children,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className="sidebar-link">
      <span className="flex w-5 justify-center" aria-hidden="true">
        {icon}
      </span>
      <span>{children}</span>
    </Link>
  );
}

/* =========================================================
   ICONS
========================================================= */

function DashboardIcon() {
  return (
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
      <rect x="3" y="3" width="7" height="9" />
      <rect x="14" y="3" width="7" height="5" />
      <rect x="14" y="12" width="7" height="9" />
      <rect x="3" y="16" width="7" height="5" />
    </svg>
  );
}

function FolderIcon() {
  return (
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
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function TeamIcon() {
  return (
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
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function SearchIcon() {
  return (
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
  );
}

function CardIcon() {
  return (
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
      <rect x="1" y="4" width="22" height="16" rx="2" />
      <line x1="1" y1="10" x2="23" y2="10" />
    </svg>
  );
}

function UserIcon() {
  return (
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
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function SettingsIcon() {
  return (
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
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function ActivityIcon() {
  return (
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
      <polyline points="23 4 23 10 17 10" />
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </svg>
  );
}

function HelpIcon() {
  return (
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
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}