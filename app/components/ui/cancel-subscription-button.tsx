// app/components/ui/cancel-subscription-button.tsx

"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";

type Props = {
  planName: string;
  endsAt: string; // ISO
};

export default function CancelSubscriptionButton({
  planName,
  endsAt,
}: Props) {
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  /* Body scroll lock */
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
    if (!open || submitting) return;

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        setError("");
      }
    }

    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, submitting]);

  const formattedEnd = new Date(endsAt).toLocaleDateString(
    "en-US",
    { month: "long", day: "numeric", year: "numeric" }
  );

  async function handleCancel() {
    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/subscription/cancel", {
        method: "POST",
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Unable to cancel.");
      }

      setOpen(false);
      setSubmitting(false);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to cancel."
      );
      setSubmitting(false);
    }
  }

  function handleClose() {
    if (submitting) return;
    setOpen(false);
    setError("");
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-stripe btn-stripe-secondary"
        style={{ color: "var(--danger)" }}
      >
        Cancel subscription
      </button>

      {mounted && open &&
        createPortal(
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
              <header
                className="border-b px-6 py-5"
                style={{ borderColor: "var(--border)" }}
              >
                <h2
                  className="text-lg font-bold"
                  style={{ color: "var(--text-primary)" }}
                >
                  Cancel your {planName} subscription?
                </h2>
              </header>

              <div className="px-6 py-6">
                <p
                  className="text-sm leading-relaxed"
                  style={{ color: "var(--text-secondary)" }}
                >
                  Your subscription will stay active until{" "}
                  <strong style={{ color: "var(--text-primary)" }}>
                    {formattedEnd}
                  </strong>
                  . After that, you won&apos;t be charged again and
                  you&apos;ll move to the Free plan.
                </p>

                <ul
                  className="mt-5 flex flex-col gap-2 text-sm"
                  style={{ color: "var(--text-secondary)" }}
                >
                  <li className="flex gap-2">
                    <span
                      style={{ color: "var(--success)" }}
                      aria-hidden="true"
                    >
                      ✓
                    </span>
                    <span>
                      Keep running audits until {formattedEnd}
                    </span>
                  </li>
                  <li className="flex gap-2">
                    <span
                      style={{ color: "var(--success)" }}
                      aria-hidden="true"
                    >
                      ✓
                    </span>
                    <span>
                      Keep your existing projects and audit history
                    </span>
                  </li>
                  <li className="flex gap-2">
                    <span
                      style={{ color: "var(--danger)" }}
                      aria-hidden="true"
                    >
                      ×
                    </span>
                    <span>
                      No further charges after {formattedEnd}
                    </span>
                  </li>
                </ul>

                {error && (
                  <div
                    className="mt-5 rounded-lg border px-4 py-3 text-sm"
                    style={{
                      borderColor: "var(--danger)",
                      background:
                        "var(--danger-light, rgba(239,68,68,0.08))",
                      color: "var(--danger)",
                    }}
                    role="alert"
                  >
                    {error}
                  </div>
                )}
              </div>

              <footer
                className="flex items-center justify-end gap-3 border-t px-6 py-4"
                style={{ borderColor: "var(--border)" }}
              >
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={submitting}
                  className="btn-stripe btn-stripe-secondary"
                >
                  Keep subscription
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={submitting}
                  className="btn-stripe btn-stripe-danger"
                >
                  {submitting
                    ? "Cancelling..."
                    : "Yes, cancel subscription"}
                </button>
              </footer>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}