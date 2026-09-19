"use client";

import { FormEvent, useEffect, useState } from "react";

type Plan = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  currency: string;
  interval: string;
  auditLimit: number;
  pagesPerAudit: number;
  aiRecommendationLimit: number;
  maxProjects: number;
  isActive: boolean;
  isFeatured: boolean;
  paystackPlanCode: string | null;
  createdAt: string;
  updatedAt: string;
};

type PlanForm = {
  name: string;
  slug: string;
  description: string;
  price: string;
  currency: string;
  interval: string;
  auditLimit: string;
  pagesPerAudit: string;
  aiRecommendationLimit: string;
  maxProjects: string;
  isActive: boolean;
  isFeatured: boolean;
};

const emptyForm: PlanForm = {
  name: "",
  slug: "",
  description: "",
  price: "0",
  currency: "NGN",
  interval: "monthly",
  auditLimit: "3",
  pagesPerAudit: "20",
  aiRecommendationLimit: "0",
  maxProjects: "1",
  isActive: true,
  isFeatured: false,
};

function formatPrice(
  price: number,
  currency: string
) {
  if (price === 0) {
    return "Free";
  }

  const amount = price / 100;

  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatInterval(interval: string) {
  switch (interval) {
    case "monthly":
      return "Monthly";

    case "quarterly":
      return "Quarterly";

    case "annually":
      return "Annually";

    default:
      return interval;
  }
}

export default function PlansClient() {
  const [plans, setPlans] = useState<Plan[]>(
    []
  );

  const [loading, setLoading] = useState(true);

  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");

  const [success, setSuccess] = useState("");

  const [showForm, setShowForm] =
    useState(false);

  const [editingPlan, setEditingPlan] =
    useState<Plan | null>(null);

  const [form, setForm] =
    useState<PlanForm>(emptyForm);

  async function loadPlans() {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        "/api/admin/plans",
        {
          cache: "no-store",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Unable to load plans."
        );
      }

      setPlans(data.plans || []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load plans."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPlans();
  }, []);

  function openCreateForm() {
    setEditingPlan(null);
    setForm(emptyForm);
    setError("");
    setSuccess("");
    setShowForm(true);
  }

  function openEditForm(plan: Plan) {
    setEditingPlan(plan);

    setForm({
      name: plan.name,
      slug: plan.slug,
      description:
        plan.description || "",
      price: String(plan.price),
      currency: plan.currency,
      interval: plan.interval,
      auditLimit: String(
        plan.auditLimit
      ),
      pagesPerAudit: String(
        plan.pagesPerAudit
      ),
      aiRecommendationLimit: String(
        plan.aiRecommendationLimit
      ),
      maxProjects: String(
        plan.maxProjects
      ),
      isActive: plan.isActive,
      isFeatured: plan.isFeatured,
    });

    setError("");
    setSuccess("");
    setShowForm(true);
  }

  function closeForm() {
    if (saving) return;

    setShowForm(false);
    setEditingPlan(null);
    setForm(emptyForm);
  }

  function updateField(
    field: keyof PlanForm,
    value: string | boolean
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const payload = {
        name: form.name,
        slug: form.slug,
        description:
          form.description || null,
        price: Number(form.price),
        currency: form.currency,
        interval: form.interval,
        auditLimit: Number(
          form.auditLimit
        ),
        pagesPerAudit: Number(
          form.pagesPerAudit
        ),
        aiRecommendationLimit: Number(
          form.aiRecommendationLimit
        ),
        maxProjects: Number(
          form.maxProjects
        ),
        isActive: form.isActive,
        isFeatured: form.isFeatured,
      };

      const url = editingPlan
        ? `/api/admin/plans/${editingPlan.id}`
        : "/api/admin/plans";

      const response = await fetch(url, {
        method: editingPlan
          ? "PATCH"
          : "POST",
        headers: {
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Unable to save plan."
        );
      }

      setSuccess(
        editingPlan
          ? "Plan updated successfully."
          : "Plan created successfully."
      );

      setShowForm(false);
      setEditingPlan(null);
      setForm(emptyForm);

      await loadPlans();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to save plan."
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(
    plan: Plan
  ) {
    try {
      setError("");
      setSuccess("");

      const response = await fetch(
        `/api/admin/plans/${plan.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            isActive: !plan.isActive,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Unable to update plan."
        );
      }

      setSuccess(
        plan.isActive
          ? "Plan deactivated."
          : "Plan activated."
      );

      await loadPlans();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to update plan."
      );
    }
  }

  async function deletePlan(
    plan: Plan
  ) {
    const confirmed = window.confirm(
      `Deactivate the "${plan.name}" plan? Existing subscriptions will not be deleted.`
    );

    if (!confirmed) {
      return;
    }

    try {
      setError("");
      setSuccess("");

      const response = await fetch(
        `/api/admin/plans/${plan.id}`,
        {
          method: "DELETE",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Unable to deactivate plan."
        );
      }

      setSuccess(
        "Plan deactivated successfully."
      );

      await loadPlans();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to deactivate plan."
      );
    }
  }

  return (
    <div className="container-fluid px-3 px-lg-4 py-4">
      <div className="d-flex flex-column flex-lg-row justify-content-between align-items-lg-center gap-3 mb-4">
        <div>
          <div className="text-muted small mb-1">
            Administration
          </div>

          <h1 className="h3 fw-bold mb-1">
            Subscription Plans
          </h1>

          <p className="text-muted mb-0">
            Create and manage the plans available
            to your SaaS customers.
          </p>
        </div>

        <button
          type="button"
          className="btn btn-primary"
          onClick={openCreateForm}
        >
          Create plan
        </button>
      </div>

      {error && (
        <div
          className="alert alert-danger"
          role="alert"
        >
          {error}
        </div>
      )}

      {success && (
        <div
          className="alert alert-success"
          role="alert"
        >
          {success}
        </div>
      )}

      {showForm && (
        <div className="card border-0 shadow-sm mb-4">
          <div className="card-body">
            <div className="d-flex justify-content-between align-items-center mb-4">
              <div>
                <h2 className="h5 fw-bold mb-1">
                  {editingPlan
                    ? "Edit plan"
                    : "Create plan"}
                </h2>

                <p className="text-muted small mb-0">
                  Prices are stored in kobo.
                </p>
              </div>

              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={closeForm}
                disabled={saving}
              >
                Cancel
              </button>
            </div>

            <form
              onSubmit={handleSubmit}
            >
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label fw-semibold">
                    Plan name
                  </label>

                  <input
                    type="text"
                    className="form-control"
                    value={form.name}
                    onChange={(event) =>
                      updateField(
                        "name",
                        event.target.value
                      )
                    }
                    placeholder="Professional"
                    required
                  />
                </div>

                <div className="col-md-6">
                  <label className="form-label fw-semibold">
                    Slug
                  </label>

                  <input
                    type="text"
                    className="form-control"
                    value={form.slug}
                    onChange={(event) =>
                      updateField(
                        "slug",
                        event.target.value
                          .toLowerCase()
                      )
                    }
                    placeholder="professional"
                    required
                  />
                </div>

                <div className="col-12">
                  <label className="form-label fw-semibold">
                    Description
                  </label>

                  <textarea
                    className="form-control"
                    rows={3}
                    value={
                      form.description
                    }
                    onChange={(event) =>
                      updateField(
                        "description",
                        event.target.value
                      )
                    }
                    placeholder="For growing businesses and SEO professionals."
                  />
                </div>

                <div className="col-md-4">
                  <label className="form-label fw-semibold">
                    Price (kobo)
                  </label>

                  <input
                    type="number"
                    min="0"
                    step="1"
                    className="form-control"
                    value={form.price}
                    onChange={(event) =>
                      updateField(
                        "price",
                        event.target.value
                      )
                    }
                    required
                  />

                  <div className="form-text">
                    ₦5,000 = 500000 kobo
                  </div>
                </div>

                <div className="col-md-4">
                  <label className="form-label fw-semibold">
                    Currency
                  </label>

                  <select
                    className="form-select"
                    value={form.currency}
                    onChange={(event) =>
                      updateField(
                        "currency",
                        event.target.value
                      )
                    }
                  >
                    <option value="NGN">
                      NGN
                    </option>
                  </select>
                </div>

                <div className="col-md-4">
                  <label className="form-label fw-semibold">
                    Billing interval
                  </label>

                  <select
                    className="form-select"
                    value={form.interval}
                    onChange={(event) =>
                      updateField(
                        "interval",
                        event.target.value
                      )
                    }
                  >
                    <option value="monthly">
                      Monthly
                    </option>

                    <option value="quarterly">
                      Quarterly
                    </option>

                    <option value="annually">
                      Annually
                    </option>
                  </select>
                </div>

                <div className="col-md-3">
                  <label className="form-label fw-semibold">
                    Audits / period
                  </label>

                  <input
                    type="number"
                    min="0"
                    className="form-control"
                    value={
                      form.auditLimit
                    }
                    onChange={(event) =>
                      updateField(
                        "auditLimit",
                        event.target.value
                      )
                    }
                    required
                  />
                </div>

                <div className="col-md-3">
                  <label className="form-label fw-semibold">
                    Pages / audit
                  </label>

                  <input
                    type="number"
                    min="1"
                    className="form-control"
                    value={
                      form.pagesPerAudit
                    }
                    onChange={(event) =>
                      updateField(
                        "pagesPerAudit",
                        event.target.value
                      )
                    }
                    required
                  />
                </div>

                <div className="col-md-3">
                  <label className="form-label fw-semibold">
                    AI recommendations
                  </label>

                  <input
                    type="number"
                    min="0"
                    className="form-control"
                    value={
                      form.aiRecommendationLimit
                    }
                    onChange={(event) =>
                      updateField(
                        "aiRecommendationLimit",
                        event.target.value
                      )
                    }
                    required
                  />
                </div>

                <div className="col-md-3">
                  <label className="form-label fw-semibold">
                    Maximum projects
                  </label>

                  <input
                    type="number"
                    min="1"
                    className="form-control"
                    value={
                      form.maxProjects
                    }
                    onChange={(event) =>
                      updateField(
                        "maxProjects",
                        event.target.value
                      )
                    }
                    required
                  />
                </div>

                <div className="col-12">
                  <div className="d-flex flex-column gap-3">
                    <div className="form-check">
                      <input
                        id="plan-active"
                        type="checkbox"
                        className="form-check-input"
                        checked={
                          form.isActive
                        }
                        onChange={(event) =>
                          updateField(
                            "isActive",
                            event.target.checked
                          )
                        }
                      />

                      <label
                        htmlFor="plan-active"
                        className="form-check-label"
                      >
                        Active plan
                      </label>
                    </div>

                    <div className="form-check">
                      <input
                        id="plan-featured"
                        type="checkbox"
                        className="form-check-input"
                        checked={
                          form.isFeatured
                        }
                        onChange={(event) =>
                          updateField(
                            "isFeatured",
                            event.target.checked
                          )
                        }
                      />

                      <label
                        htmlFor="plan-featured"
                        className="form-check-label"
                      >
                        Featured plan
                      </label>
                    </div>
                  </div>
                </div>

                <div className="col-12">
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={saving}
                  >
                    {saving
                      ? "Saving..."
                      : editingPlan
                        ? "Update plan"
                        : "Create plan"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="card border-0 shadow-sm">
        <div className="card-body">
          <div className="d-flex justify-content-between align-items-center mb-4">
            <div>
              <h2 className="h5 fw-bold mb-1">
                Plans
              </h2>

              <p className="text-muted small mb-0">
                Manage subscription tiers and
                usage limits.
              </p>
            </div>

            <span className="badge text-bg-light">
              {plans.length}{" "}
              {plans.length === 1
                ? "plan"
                : "plans"}
            </span>
          </div>

          {loading ? (
            <div className="d-flex align-items-center gap-3 py-5">
              <div
                className="spinner-border"
                role="status"
              />

              <span>
                Loading plans...
              </span>
            </div>
          ) : plans.length === 0 ? (
            <div className="alert alert-info mb-0">
              No subscription plans have been
              created yet.
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table align-middle">
                <thead>
                  <tr>
                    <th>Plan</th>
                    <th>Price</th>
                    <th>Audits</th>
                    <th>Pages</th>
                    <th>AI</th>
                    <th>Projects</th>
                    <th>Status</th>
                    <th className="text-end">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {plans.map((plan) => (
                    <tr key={plan.id}>
                      <td>
                        <div className="fw-semibold">
                          {plan.name}
                        </div>

                        <div className="text-muted small">
                          {plan.slug}
                        </div>

                        {plan.isFeatured && (
                          <span className="badge text-bg-primary mt-1">
                            Featured
                          </span>
                        )}
                      </td>

                      <td>
                        <div className="fw-semibold">
                          {formatPrice(
                            plan.price,
                            plan.currency
                          )}
                        </div>

                        <div className="text-muted small">
                          {formatInterval(
                            plan.interval
                          )}
                        </div>
                      </td>

                      <td>
                        {plan.auditLimit}
                      </td>

                      <td>
                        {plan.pagesPerAudit}
                      </td>

                      <td>
                        {plan.aiRecommendationLimit}
                      </td>

                      <td>
                        {plan.maxProjects}
                      </td>

                      <td>
                        {plan.isActive ? (
                          <span className="badge text-bg-success">
                            Active
                          </span>
                        ) : (
                          <span className="badge text-bg-secondary">
                            Inactive
                          </span>
                        )}
                      </td>

                      <td>
                        <div className="d-flex justify-content-end gap-2">
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-primary"
                            onClick={() =>
                              openEditForm(
                                plan
                              )
                            }
                          >
                            Edit
                          </button>

                          <button
                            type="button"
                            className={`btn btn-sm ${
                              plan.isActive
                                ? "btn-outline-warning"
                                : "btn-outline-success"
                            }`}
                            onClick={() =>
                              toggleActive(
                                plan
                              )
                            }
                          >
                            {plan.isActive
                              ? "Deactivate"
                              : "Activate"}
                          </button>

                          {plan.isActive && (
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-danger"
                              onClick={() =>
                                deletePlan(
                                  plan
                                )
                              }
                            >
                              Disable
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}