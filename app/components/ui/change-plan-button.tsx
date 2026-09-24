// app/components/ui/change-plan-button.tsx

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { ChangePlanModal } from "./change-plan-modal";

type ChangePlanButtonProps = {
  planId: string;
  planSlug: string;
  planName: string;
  planPrice: number;
  planInterval: string;
  planCurrency: string;
  isFeatured?: boolean;

  /* Current subscription context */
  currentPlanId: string;
  currentPlanName: string;
  currentPlanEndsAt: string; // ISO
  currentPlanPrice: number;
  currentPlanInterval: string;
};

export default function ChangePlanButton({
  planId,
  planSlug,
  planName,
  planPrice,
  planInterval,
  planCurrency,
  isFeatured,
  currentPlanId,
  currentPlanName,
  currentPlanEndsAt,
  currentPlanPrice,
  currentPlanInterval,
}: ChangePlanButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          isFeatured
            ? "btn-stripe btn-stripe-primary mt-6 w-full"
            : "btn-stripe btn-stripe-secondary mt-6 w-full"
        }
      >
        Switch to {planName}
      </button>

     <ChangePlanModal
          open={open}
          onClose={() => setOpen(false)}
          target={{
            id: planId,
            slug: planSlug,
            name: planName,
            price: Number(planPrice),           // ← coerce here too
            interval: planInterval,
            currency: planCurrency,
          }}
          current={{
            id: currentPlanId,
            name: currentPlanName,
            endsAt: currentPlanEndsAt,
            price: Number(currentPlanPrice),    // ← and here
            interval: currentPlanInterval,
          }}
        />
    </>
  );
}