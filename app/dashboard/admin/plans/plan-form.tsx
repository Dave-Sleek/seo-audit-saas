"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

/* =========================================================
   TYPES
========================================================= */

export type PlanFormData = {
  id?: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  currency: string;
  interval: string;
  auditLimit: number;
  pagesPerAudit: number;
  aiRecommendationLimit: number;
  maxProjects: number;
  isActive: boolean;
  isFeatured: boolean;
  paystackPlanCode: string;
};

type Props = {
  mode: "create" | "edit";
  initial: PlanFormData;
};

/* =========================================================
   COMPONENT
========================================================= */

export default function PlanForm({ mode, initial }: Props) {
  const router = useRouter();

  const [form, setForm] = useState<PlanFormData>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  function update<K extends keyof PlanFormData>(
    key: K,
    value: PlanFormData[K]
  ) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    const payload = {
      name: form.name,
      slug: form.slug,
      description: form.description || null,
      price: Number(form.price),
      currency: form.currency,
      interval: form.interval,
      auditLimit: Number(form.auditLimit),
      pagesPerAudit: Number(form.pagesPerAudit),
      aiRecommendationLimit: Number(form.aiRecommendationLimit),
      maxProjects: Number(form.maxProjects),
      isActive: form.isActive,
      isFeatured: form.isFeatured,
      paystackPlanCode: form.paystackPlanCode || null,
    };

    try {
      const url =
        mode === "create"
          ? "/api/admin/plans"
          : `/api/admin/plans/${form.id}`;

      const method = mode === "create" ? "POST" : "PATCH";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const contentType = response.headers.get("content-type") || "";

      if (!contentType.includes("application/json")) {
        const text = await response.text();
        console.error("Non-JSON response", {
          status: response.status,
          preview: text.slice(0, 300),
        });
        throw new Error(
          `Server returned ${response.status}. Please try again.`
        );
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to save plan.");
      }

      setSuccess(
        mode === "create" ? "Plan created successfully." : "Changes saved."
      );

      if (mode === "create" && data.plan?.id) {
        // Redirect to the edit page for the new plan
        router.push(`/dashboard/admin/plans/${data.plan.id}`);
        return;
      }

      // Refresh server data on the edit page
      router.refresh();

      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  function handleDeactivate() {
    if (mode !== "edit" || !form.id) return;

    const confirmed = window.confirm(
      "Deactivate this plan? Existing subscriptions will still work, but the plan will no longer appear on the pricing page."
    );

    if (!confirmed) return;

    setSaving(true);
    setError("");
    setSuccess("");

    fetch(`/api/admin/plans/${form.id}`, { method: "DELETE" })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || "Unable to deactivate.");
        update("isActive", false);
        update("isFeatured", false);
        setSuccess("Plan deactivated.");
        router.refresh();
        setTimeout(() => setSuccess(""), 3000);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      })
      .finally(() => setSaving(false));
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {/* ---------- Feedback ---------- */}
      {error && (
        <div className="stripe-alert stripe-alert-danger" role="alert">
          <div>
            <div className="font-semibold">Could not save</div>
            <div className="mt-0.5">{error}</div>
          </div>
        </div>
      )}

      {success && (
        <div className="stripe-alert stripe-alert-success" role="status">
          <div>{success}</div>
        </div>
      )}

      {/* ---------- Basics ---------- */}
      <section className="stripe-panel">
        <header
          className="border-b px-6 py-5"
          style={{ borderColor: "var(--border)" }}
        >
          <h2 className="section-title">Basics</h2>
          <p className="section-description">
            How this plan appears on the pricing page.
          </p>
        </header>

        <div className="grid gap-5 px-6 py-6 sm:grid-cols-2">
          <Field label="Plan name" required>
            <input
              type="text"
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              placeholder="Starter"
              className="stripe-input"
              required
            />
          </Field>

          <Field
            label="Slug"
            required
            hint="Lowercase letters, numbers, hyphens."
          >
            <input
              type="text"
              value={form.slug}
              onChange={(e) =>
                update("slug", e.target.value.toLowerCase())
              }
              placeholder="starter"
              pattern="[a-z0-9-]+"
              className="stripe-input"
              required
            />
          </Field>

          <Field label="Description" className="sm:col-span-2">
            <textarea
              value={form.description}
              onChange={(e) => update("description", e.target.value)}
              placeholder="For individuals and small websites."
              rows={3}
              className="stripe-input"
              style={{ minHeight: 80, paddingTop: 10, paddingBottom: 10 }}
            />
          </Field>
        </div>
      </section>

      {/* ---------- Pricing ---------- */}
      <section className="stripe-panel">
        <header
          className="border-b px-6 py-5"
          style={{ borderColor: "var(--border)" }}
        >
          <h2 className="section-title">Pricing</h2>
          <p className="section-description">
            Prices are stored in the smallest currency unit (kobo for NGN).
          </p>
        </header>

        <div className="grid gap-5 px-6 py-6 sm:grid-cols-2">
          <Field
          label="Price (naira)"
            // label="Price (kobo)"
            required
            hint={`₦${Number(form.price).toLocaleString("en-NG")} charged per period`}
            // hint={`₦${(Number(form.price) / 100).toLocaleString()} charged per period`}
          >
            <input
              type="number"
              value={form.price}
              onChange={(e) => update("price", Number(e.target.value))}
              min={0}
              step={1}
              className="stripe-input"
              required
            />
          </Field>

          <Field label="Currency" required>
            <input
              type="text"
              value={form.currency}
              onChange={(e) =>
                update("currency", e.target.value.toUpperCase())
              }
              placeholder="NGN"
              maxLength={5}
              className="stripe-input"
              required
            />
          </Field>

          <Field label="Billing interval" required>
            <select
              value={form.interval}
              onChange={(e) => update("interval", e.target.value)}
              className="stripe-input"
            >
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="annually">Annually</option>
            </select>
          </Field>

          <Field
            label="Paystack plan code"
            hint="Optional. Required for recurring subscriptions."
          >
            <input
              type="text"
              value={form.paystackPlanCode}
              onChange={(e) => update("paystackPlanCode", e.target.value)}
              placeholder="PLN_xxxxxxxxxxxx"
              className="stripe-input"
            />
          </Field>
        </div>
      </section>

      {/* ---------- Limits ---------- */}
      <section className="stripe-panel">
        <header
          className="border-b px-6 py-5"
          style={{ borderColor: "var(--border)" }}
        >
          <h2 className="section-title">Limits</h2>
          <p className="section-description">
            What this plan permits during each subscription period.
          </p>
        </header>

        <div className="grid gap-5 px-6 py-6 sm:grid-cols-2">
          <Field label="Audits per period" required>
            <input
              type="number"
              value={form.auditLimit}
              onChange={(e) => update("auditLimit", Number(e.target.value))}
              min={0}
              step={1}
              className="stripe-input"
              required
            />
          </Field>

          <Field label="Pages per audit" required>
            <input
              type="number"
              value={form.pagesPerAudit}
              onChange={(e) =>
                update("pagesPerAudit", Number(e.target.value))
              }
              min={1}
              step={1}
              className="stripe-input"
              required
            />
          </Field>

          <Field label="AI recommendations per period" required>
            <input
              type="number"
              value={form.aiRecommendationLimit}
              onChange={(e) =>
                update("aiRecommendationLimit", Number(e.target.value))
              }
              min={0}
              step={1}
              className="stripe-input"
              required
            />
          </Field>

          <Field label="Maximum projects" required>
            <input
              type="number"
              value={form.maxProjects}
              onChange={(e) =>
                update("maxProjects", Number(e.target.value))
              }
              min={1}
              step={1}
              className="stripe-input"
              required
            />
          </Field>
        </div>
      </section>

      {/* ---------- Visibility ---------- */}
      <section className="stripe-panel">
        <header
          className="border-b px-6 py-5"
          style={{ borderColor: "var(--border)" }}
        >
          <h2 className="section-title">Visibility</h2>
          <p className="section-description">
            Control how this plan appears to users.
          </p>
        </header>

        <div className="flex flex-col gap-4 px-6 py-6">
          <Toggle
            label="Active"
            description="Show this plan on the pricing page."
            checked={form.isActive}
            onChange={(v) => update("isActive", v)}
          />

          <Toggle
            label="Featured"
            description="Highlight as the most popular plan. Only one plan can be featured at a time."
            checked={form.isFeatured}
            onChange={(v) => update("isFeatured", v)}
          />
        </div>
      </section>

      {/* ---------- Actions ---------- */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="btn-stripe btn-stripe-primary"
        >
          {saving ? (
            <>
              <span className="spinner-stripe" aria-hidden="true" />
              Saving...
            </>
          ) : mode === "create" ? (
            "Create plan"
          ) : (
            "Save changes"
          )}
        </button>

        {mode === "edit" && form.isActive && (
          <button
            type="button"
            onClick={handleDeactivate}
            disabled={saving}
            className="btn-stripe btn-stripe-danger"
          >
            Deactivate plan
          </button>
        )}
      </div>
    </form>
  );
}

/* =========================================================
   FIELD
========================================================= */

function Field({
  label,
  hint,
  required,
  children,
  className = "",
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="stripe-label">
        {label}
        {required && (
          <span style={{ color: "var(--danger)", marginLeft: 4 }}>*</span>
        )}
      </label>
      {children}
      {hint && (
        <p
          className="mt-1.5 text-xs"
          style={{ color: "var(--text-muted)" }}
        >
          {hint}
        </p>
      )}
    </div>
  );
}

/* =========================================================
   TOGGLE
========================================================= */

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 h-4 w-4 shrink-0 cursor-pointer accent-[var(--primary)]"
      />
      <div>
        <div
          className="text-sm font-semibold"
          style={{ color: "var(--text-primary)" }}
        >
          {label}
        </div>
        <div
          className="mt-0.5 text-xs"
          style={{ color: "var(--text-muted)" }}
        >
          {description}
        </div>
      </div>
    </label>
  );
}