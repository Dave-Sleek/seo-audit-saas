"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type AccountMenuProps = {
  user: {
    name: string | null;
    email: string;
  };
};

export default function AccountMenu({
  user,
}: AccountMenuProps) {
  const router = useRouter();
  const menuRef = useRef<HTMLDivElement>(null);

  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] =
    useState(false);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(
          event.target as Node
        )
      ) {
        setOpen(false);
      }
    }

    document.addEventListener(
      "mousedown",
      handleClickOutside
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleClickOutside
      );
    };
  }, []);

  async function handleLogout() {
    setLoggingOut(true);

    try {
      const response = await fetch(
        "/api/auth/logout",
        {
          method: "POST",
        }
      );

      if (!response.ok) {
        throw new Error(
          "Unable to log out."
        );
      }

      router.push("/login");
      router.refresh();
    } catch {
      setLoggingOut(false);
    }
  }

  const displayName =
    user.name?.trim() ||
    user.email.split("@")[0];

  const initial = displayName
    .charAt(0)
    .toUpperCase();

  const itemClass =
    "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-slate-700 transition hover:bg-slate-50";

  return (
    <div
      ref={menuRef}
      className="relative"
    >
      <button
        type="button"
        onClick={() =>
          setOpen((value) => !value)
        }
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 transition hover:bg-slate-50"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white">
          {initial}
        </span>

        <span className="hidden text-left sm:block">
          <span className="block max-w-[140px] truncate text-sm font-semibold text-slate-900">
            {displayName}
          </span>

          <span className="block max-w-[140px] truncate text-xs text-slate-500">
            {user.email}
          </span>
        </span>

        <svg
          className={`h-4 w-4 text-slate-500 transition ${
            open ? "rotate-180" : ""
          }`}
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.51a.75.75 0 01-1.08 1.04l-4.25-4.51a.75.75 0 01.02-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {open && (
        <div
          className="absolute right-0 z-50 mt-2 w-72 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
          role="menu"
        >
          {/* Account header */}
          <div className="border-b border-slate-100 px-4 py-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white">
                {initial}
              </span>

              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">
                  {displayName}
                </p>

                <p className="truncate text-xs text-slate-500">
                  {user.email}
                </p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <div className="p-2">
            <Link
              href="/dashboard"
              onClick={() => setOpen(false)}
              className={itemClass}
              role="menuitem"
            >
              <i className="bi bi-speedometer2 w-5 text-center text-slate-500" />
              <span>Dashboard</span>
            </Link>

            <Link
              href="/dashboard/projects"
              onClick={() => setOpen(false)}
              className={itemClass}
              role="menuitem"
            >
              <i className="bi bi-folder2-open w-5 text-center text-slate-500" />
              <span>Projects</span>
            </Link>

            <Link
              href="/dashboard/audits"
              onClick={() => setOpen(false)}
              className={itemClass}
              role="menuitem"
            >
              <i className="bi bi-search w-5 text-center text-slate-500" />
              <span>Audits</span>
            </Link>

            <Link
              href="/dashboard/subscription"
              onClick={() => setOpen(false)}
              className={itemClass}
              role="menuitem"
            >
              <i className="bi bi-credit-card w-5 text-center text-slate-500" />
              <span>Subscription</span>
            </Link>

            <Link
              href="/dashboard/profile"
              onClick={() => setOpen(false)}
              className={itemClass}
              role="menuitem"
            >
              <i className="bi bi-person w-5 text-center text-slate-500" />
              <span>Profile</span>
            </Link>
          </div>

          {/* Logout */}
          <div className="border-t border-slate-100 p-2">
            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
              role="menuitem"
            >
              <i className="bi bi-box-arrow-right w-5 text-center" />

              <span>
                {loggingOut
                  ? "Logging out..."
                  : "Logout"}
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}