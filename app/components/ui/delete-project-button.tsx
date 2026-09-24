"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";

type Props = {
  projectId: string;
  projectName: string;
  projectDomain: string;
  auditCount: number;
};

export default function DeleteProjectButton({
  projectId,
  projectName,
  projectDomain,
  auditCount,
}: Props) {
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [mounted, setMounted] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  useEffect(() => {
    if (!open || submitting) return;

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        setConfirmText("");
        setError("");
      }
    }

    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, submitting]);

  const matchesDomain =
    confirmText.trim().toLowerCase() ===
    projectDomain.trim().toLowerCase();

  const canDelete = matchesDomain && !submitting;

  async function handleDelete() {
    if (!canDelete) return;

    setSubmitting(true);
    setError("");

    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "DELETE",
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(
          data?.error || "Unable to delete project."
        );
      }

      setOpen(false);

      /*
       * Redirect to the projects list. The project no
       * longer exists, so staying on this page would 404
       * on the next request anyway.
       */
      router.push("/dashboard/projects");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to delete project."
      );
      setSubmitting(false);
    }
  }

  function handleClose() {
    if (submitting) return;
    setOpen(false);
    setConfirmText("");
    setError("");
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-stripe btn-stripe-danger shrink-0"
      >
        <i className="bi bi-trash" />
        <span>Delete project</span>
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
              className="relative z-10 w-full max-w-lg overflow-hidden rounded-2xl border bg-white shadow-2xl"
              style={{ borderColor: "var(--border)" }}
            >
              <header className="border-b border-slate-200 px-6 py-5">
                <div className="flex items-start gap-3">
                  <span
                    className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600"
                    aria-hidden="true"
                  >
                    <i className="bi bi-exclamation-triangle" />
                  </span>

                  <div className="min-w-0">
                    <h2 className="text-lg font-bold text-slate-900">
                      Delete {projectName}?
                    </h2>

                    <p className="mt-1 text-sm text-slate-500">
                      This action cannot be undone.
                    </p>
                  </div>
                </div>
              </header>

              <div className="px-6 py-6">
                <p className="text-sm leading-relaxed text-slate-600">
                  You are about to permanently delete:
                </p>

                <ul className="mt-4 flex flex-col gap-2 text-sm text-slate-600">
                  <li className="flex gap-2">
                    <span
                      className="text-red-600"
                      aria-hidden="true"
                    >
                      ×
                    </span>
                    <span>
                      The project{" "}
                      <strong className="text-slate-900">
                        {projectDomain}
                      </strong>
                    </span>
                  </li>

                  {auditCount > 0 && (
                    <li className="flex gap-2">
                      <span
                        className="text-red-600"
                        aria-hidden="true"
                      >
                        ×
                      </span>
                      <span>
                        <strong className="text-slate-900">
                          {auditCount}{" "}
                          {auditCount === 1 ? "audit" : "audits"}
                        </strong>{" "}
                        and all their results — scores, pages,
                        issues, and history
                      </span>
                    </li>
                  )}
                </ul>

                <p className="mt-5 text-sm text-slate-500">
                  Your subscription and other projects are not
                  affected.
                </p>

                <div className="mt-6">
                  <label
                    htmlFor="confirm-delete"
                    className="stripe-label"
                  >
                    Type{" "}
                    <strong className="text-slate-900">
                      {projectDomain}
                    </strong>{" "}
                    to confirm
                  </label>

                  <input
                    id="confirm-delete"
                    type="text"
                    value={confirmText}
                    onChange={(e) =>
                      setConfirmText(e.target.value)
                    }
                    placeholder={projectDomain}
                    autoComplete="off"
                    autoFocus
                    disabled={submitting}
                    className="stripe-input font-mono"
                  />
                </div>

                {error && (
                  <div
                    className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                    role="alert"
                  >
                    {error}
                  </div>
                )}
              </div>

              <footer className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={submitting}
                  className="btn-stripe btn-stripe-secondary"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={!canDelete}
                  className="btn-stripe btn-stripe-danger"
                >
                  {submitting ? (
                    <>
                      <span
                        className="spinner-stripe"
                        aria-hidden="true"
                      />
                      Deleting...
                    </>
                  ) : (
                    "Delete forever"
                  )}
                </button>
              </footer>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}