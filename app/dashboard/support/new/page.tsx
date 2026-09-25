// app/dashboard/support/new/page.tsx

import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/app/lib/auth";
import NewTicketForm from "./new-ticket-form";

export const dynamic = "force-dynamic";

export default async function NewTicketPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <nav className="breadcrumbs mb-3" aria-label="Breadcrumb">
          <Link href="/dashboard">Dashboard</Link>
          <span className="breadcrumb-separator">/</span>
          <Link href="/dashboard/support">Support</Link>
          <span className="breadcrumb-separator">/</span>
          <span className="text-slate-900">New ticket</span>
        </nav>

        <div className="eyebrow mb-1">Support</div>
        <h1 className="page-title">Submit a ticket</h1>
        <p className="page-subtitle">
          Tell us what&apos;s happening and we&apos;ll get back to
          you as soon as we can.
        </p>
      </div>

      {/* Form */}
      <section className="stripe-panel">
        <div className="px-6 py-6">
          <NewTicketForm />
        </div>
      </section>
    </div>
  );
}