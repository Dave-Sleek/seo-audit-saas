// app/components/ui/change-plan-modal.tsx

"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";

/* =========================================================
   TYPES
========================================================= */

type PlanInfo = {
  id: string;
  slug: string;
  name: string;
  price: number;
  interval: string;
  currency: string;
};

type CurrentPlanInfo = {
  id: string;
  name: string;
  endsAt: string;
  price: number;
  interval: string;
};

type ChangeDirection =
  | "upgrade"
  | "paid_downgrade"
  | "to_free"
  | "no_change";

type Props = {
  open: boolean;
  onClose: () => void;
  target: PlanInfo;
  current: CurrentPlanInfo;
};

type Step =
  | { kind: "confirm" }
  | { kind: "processing" }
  | { kind: "error"; message: string };

/* =========================================================
   DIRECTION CLASSIFICATION
========================================================= */

function classifyChange({
  currentPrice,
  currentInterval,
  targetPrice,
  targetInterval,
}: {
  currentPrice: number;
  currentInterval: string;
  targetPrice: number;
  targetInterval: string;
}): ChangeDirection {
  /*
   * Force numeric — DB numerics can come back as strings,
   * and "1200000" > "500000" is FALSE in string comparison.
   */
  const cPrice = Number(currentPrice);
  const tPrice = Number(targetPrice);

  const currentDaily =
    cPrice / daysInInterval(currentInterval);
  const targetDaily =
    tPrice / daysInInterval(targetInterval);

  /* Same effective rate → not a change */
  if (Math.abs(targetDaily - currentDaily) < 0.01) {
    return "no_change";
  }

  /* Switching to a free plan is a cancellation */
  if (tPrice === 0) {
    return "to_free";
  }

  /* Switching FROM free is always an upgrade */
  if (cPrice === 0) {
    return "upgrade";
  }

  return targetDaily > currentDaily
    ? "upgrade"
    : "paid_downgrade";
}

/* =========================================================
   MODAL
========================================================= */

export function ChangePlanModal({
  open,
  onClose,
  target,
  current,
}: Props) {
  const [step, setStep] = useState<Step>({ kind: "confirm" });
  const [mounted, setMounted] = useState(false);

  /* Hydration gate — portals only run on the client */
  useEffect(() => {
    setMounted(true);
  }, []);

  /* Lock body scroll while open */
  useEffect(() => {
    if (!open) return;

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  /* Escape to close */
  useEffect(() => {
    if (!open) return;

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setStep({ kind: "confirm" });
        onClose();
      }
    }

    document.addEventListener("keydown", onKey);
    return () =>
      document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  /* ---------- Derived values (before any early return) ---------- */

  const direction = classifyChange({
    currentPrice: Number(current.price),
    currentInterval: current.interval,
    targetPrice: Number(target.price),
    targetInterval: target.interval,
  });

  const effectiveDate = new Date(current.endsAt);
  const formattedEffective = effectiveDate.toLocaleDateString(
    "en-US",
    { month: "long", day: "numeric", year: "numeric" }
  );

  /* ---------- Actions ---------- */

  async function handleConfirm() {
    setStep({ kind: "processing" });

    try {
      const res = await fetch(
        "/api/subscription/change-plan",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ planId: target.id }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        setStep({
          kind: "error",
          message: data.error ?? "Unable to change plan.",
        });
        return;
      }

      if (data.action === "checkout") {
        window.location.href = `/api/payments/initialize?planId=${encodeURIComponent(
          target.id
        )}`;
        return;
      }

      setStep({
        kind: "error",
        message: "Unexpected response from server.",
      });
    } catch {
      setStep({
        kind: "error",
        message: "Network error. Please try again.",
      });
    }
  }

  function handleClose() {
    setStep({ kind: "confirm" });
    onClose();
  }

  if (!mounted || !open) return null;

  /* ---------- Render through portal ---------- */

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto p-4"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="fixed inset-0"
        style={{ background: "rgba(0,0,0,0.5)" }}
        onClick={handleClose}
        aria-hidden="true"
      />

      <div
        className="relative z-10 w-full max-w-lg overflow-hidden rounded-2xl border shadow-2xl"
        style={{
          borderColor: "var(--border)",
          background: "var(--surface)",
        }}
      >
        {step.kind === "confirm" && (
          <ConfirmView
            target={target}
            current={current}
            direction={direction}
            formattedEffective={formattedEffective}
            onCancel={handleClose}
            onConfirm={handleConfirm}
          />
        )}

        {step.kind === "processing" && (
          <div className="px-6 py-12 text-center">
            <div
              className="spinner-stripe mx-auto mb-4"
              aria-hidden="true"
            />
            <p
              className="text-sm"
              style={{ color: "var(--text-muted)" }}
            >
              Preparing checkout...
            </p>
          </div>
        )}

        {step.kind === "error" && (
          <div className="px-6 py-8">
            <div
              className="rounded-lg border px-4 py-3"
              style={{
                borderColor: "var(--danger)",
                background:
                  "var(--danger-light, rgba(239,68,68,0.08))",
              }}
              role="alert"
            >
              <div
                className="text-sm font-semibold"
                style={{ color: "var(--danger)" }}
              >
                Could not change plan
              </div>
              <div
                className="mt-1 text-sm"
                style={{ color: "var(--text-secondary)" }}
              >
                {step.message}
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={handleClose}
                className="btn-stripe btn-stripe-secondary"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => setStep({ kind: "confirm" })}
                className="btn-stripe btn-stripe-primary"
              >
                Try again
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

/* =========================================================
   CONFIRM VIEW
========================================================= */

function ConfirmView({
  target,
  current,
  direction,
  formattedEffective,
  onCancel,
  onConfirm,
}: {
  target: PlanInfo;
  current: CurrentPlanInfo;
  direction: ChangeDirection;
  formattedEffective: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const title =
    direction === "upgrade"
      ? `Upgrade to ${target.name}`
      : direction === "to_free"
        ? "Cancel subscription"
        : `Switch to ${target.name}`;

  const subtitle =
    direction === "upgrade"
      ? "You'll be charged now and the new plan begins after your current period ends."
      : direction === "paid_downgrade"
        ? "Downgrades aren't self-service yet. Here's what to do."
        : direction === "to_free"
          ? "Cancelling will stop your subscription at the end of the current period."
          : "";

  return (
    <>
      <header
        className="border-b px-6 py-5"
        style={{ borderColor: "var(--border)" }}
      >
        <h2
          className="text-lg font-bold"
          style={{ color: "var(--text-primary)" }}
        >
          {title}
        </h2>
        {subtitle && (
          <p
            className="mt-1 text-sm"
            style={{ color: "var(--text-muted)" }}
          >
            {subtitle}
          </p>
        )}
      </header>

      <div className="px-6 py-6">
        {direction === "upgrade" && (
          <UpgradeContent
            target={target}
            current={current}
            formattedEffective={formattedEffective}
          />
        )}

        {direction === "paid_downgrade" && (
          <PaidDowngradeContent
            target={target}
            current={current}
            formattedEffective={formattedEffective}
          />
        )}

        {direction === "to_free" && (
          <ToFreeContent
            current={current}
            formattedEffective={formattedEffective}
          />
        )}
      </div>

      <footer
        className="flex items-center justify-end gap-3 border-t px-6 py-4"
        style={{ borderColor: "var(--border)" }}
      >
        <button
          type="button"
          onClick={onCancel}
          className="btn-stripe btn-stripe-secondary"
        >
          {direction === "upgrade" ? "Cancel" : "Close"}
        </button>

        {direction === "upgrade" && (
          <button
            type="button"
            onClick={onConfirm}
            className="btn-stripe btn-stripe-primary"
          >
            Continue to payment
          </button>
        )}

        {(direction === "paid_downgrade" ||
          direction === "to_free") && (
          <Link
            href="/dashboard/subscription"
            className="btn-stripe btn-stripe-primary"
          >
            Manage subscription
          </Link>
        )}
      </footer>
    </>
  );
}

/* =========================================================
   CONTENT — UPGRADE
========================================================= */

function UpgradeContent({
  target,
  current,
  formattedEffective,
}: {
  target: PlanInfo;
  current: CurrentPlanInfo;
  formattedEffective: string;
}) {
  return (
    <>
      <div className="flex flex-col gap-4">
        <PlanRow
          label="Current plan"
          name={current.name}
          price={Number(current.price)}
          interval={current.interval}
          currency={target.currency}
          subtle
        />

        <div className="flex items-center gap-3">
          <div
            className="h-px flex-1"
            style={{ background: "var(--border)" }}
          />
          <span
            className="text-xs font-semibold uppercase tracking-wide"
            style={{ color: "var(--text-muted)" }}
          >
            changes to
          </span>
          <div
            className="h-px flex-1"
            style={{ background: "var(--border)" }}
          />
        </div>

        <PlanRow
          label="New plan"
          name={target.name}
          price={Number(target.price)}
          interval={target.interval}
          currency={target.currency}
          highlight
        />
      </div>

      <div
        className="mt-6 rounded-lg p-4"
        style={{ background: "var(--border-light)" }}
      >
        <div className="flex items-start gap-2">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              color: "var(--text-muted)",
              flexShrink: 0,
              marginTop: 2,
            }}
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <div
            className="text-sm leading-relaxed"
            style={{ color: "var(--text-secondary)" }}
          >
            You&apos;ll pay{" "}
            <strong>
              {formatPrice({
                price: Number(target.price),
                currency: target.currency,
              })}
            </strong>{" "}
            now. Your current plan stays active until{" "}
            <strong>{formattedEffective}</strong>, then{" "}
            {target.name} begins and runs for one{" "}
            {normalizeInterval(target.interval)}.
          </div>
        </div>
      </div>
    </>
  );
}

/* =========================================================
   CONTENT — PAID DOWNGRADE
========================================================= */

function PaidDowngradeContent({
  target,
  current,
  formattedEffective,
}: {
  target: PlanInfo;
  current: CurrentPlanInfo;
  formattedEffective: string;
}) {
  return (
    <InfoPanel
      title={`Can't switch to ${target.name} right now`}
      body={
        <>
          We don&apos;t support self-service downgrades yet. To
          switch to {target.name}, cancel your current{" "}
          {current.name} subscription first, then resubscribe once
          your current period ends on{" "}
          <strong style={{ color: "var(--text-secondary)" }}>
            {formattedEffective}
          </strong>
          .
        </>
      }
    />
  );
}

/* =========================================================
   CONTENT — TO FREE
========================================================= */

function ToFreeContent({
  current,
  formattedEffective,
}: {
  current: CurrentPlanInfo;
  formattedEffective: string;
}) {
  return (
    <InfoPanel
      title={`Cancel your ${current.name} subscription`}
      body={
        <>
          You&apos;ll keep your {current.name} features until{" "}
          <strong style={{ color: "var(--text-secondary)" }}>
            {formattedEffective}
          </strong>
          . After that, you&apos;ll be on the Free plan and
          won&apos;t be charged again.
        </>
      }
    />
  );
}

/* =========================================================
   INFO PANEL (shared shape for both non-upgrade cases)
========================================================= */

function InfoPanel({
  title,
  body,
}: {
  title: string;
  body: React.ReactNode;
}) {
  return (
    <div
      className="rounded-lg border p-5"
      style={{
        borderColor: "var(--border)",
        background: "var(--surface)",
      }}
    >
      <div className="flex items-start gap-3">
        <span
          className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
          style={{
            background: "var(--border-light)",
            color: "var(--text-muted)",
          }}
          aria-hidden="true"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </span>

        <div className="min-w-0">
          <h3
            className="text-base font-bold"
            style={{ color: "var(--text-primary)" }}
          >
            {title}
          </h3>
          <p
            className="mt-2 text-sm leading-relaxed"
            style={{ color: "var(--text-muted)" }}
          >
            {body}
          </p>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   PLAN ROW
========================================================= */

function PlanRow({
  label,
  name,
  price,
  interval,
  currency,
  subtle,
  highlight,
}: {
  label: string;
  name: string;
  price: number;
  interval: string;
  currency: string;
  subtle?: boolean;
  highlight?: boolean;
}) {
  return (
    <div
      className="flex items-center justify-between rounded-lg border p-4"
      style={{
        borderColor: highlight
          ? "var(--primary)"
          : "var(--border)",
        background: subtle
          ? "var(--border-light)"
          : "transparent",
      }}
    >
      <div>
        <div
          className="text-xs font-medium uppercase tracking-wide"
          style={{ color: "var(--text-subtle)" }}
        >
          {label}
        </div>
        <div
          className="mt-1 text-base font-bold"
          style={{ color: "var(--text-primary)" }}
        >
          {name}
        </div>
      </div>
      <div className="text-right">
        <div
          className="text-base font-bold tabular-nums"
          style={{ color: "var(--text-primary)" }}
        >
          {formatPrice({ price: Number(price), currency })}
        </div>
        <div
          className="text-xs"
          style={{ color: "var(--text-muted)" }}
        >
          per {normalizeInterval(interval)}
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   HELPERS
========================================================= */

function daysInInterval(interval: string): number {
  switch (interval.toLowerCase()) {
    case "daily":
      return 1;
    case "weekly":
      return 7;
    case "monthly":
      return 30;
    case "quarterly":
      return 90;
    case "biannual":
    case "semiannual":
      return 180;
    case "annual":
    case "yearly":
      return 365;
    default:
      return 30;
  }
}

function normalizeInterval(interval: string): string {
  switch (interval.toLowerCase()) {
    case "monthly":
      return "month";
    case "yearly":
    case "annual":
      return "year";
    case "weekly":
      return "week";
    case "daily":
      return "day";
    case "quarterly":
      return "quarter";
    default:
      return "period";
  }
}

function formatPrice({
  price,
  currency,
}: {
  price: number;
  currency: string;
}): string {
  const zeroDecimal = ["JPY", "KRW", "VND"].includes(currency);
  const major = zeroDecimal ? Number(price) : Number(price) / 100;

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: zeroDecimal ? 0 : 2,
    maximumFractionDigits: zeroDecimal ? 0 : 2,
  }).format(major);
}