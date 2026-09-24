// app/verify-email/confirm/page.tsx

import { Suspense } from "react";

import VerifyEmailConfirmClient from "./verify-email-confirm-client";

export const dynamic = "force-dynamic";

export default function VerifyEmailConfirmPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
          <div className="flex items-center gap-3">
            <div
              className="spinner-stripe"
              role="status"
              aria-label="Loading"
            />
            <span className="text-sm text-slate-600">
              Loading...
            </span>
          </div>
        </div>
      }
    >
      <VerifyEmailConfirmClient />
    </Suspense>
  );
}