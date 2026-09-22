import { NextResponse } from "next/server";
import { extendSubscriptionFromRenewal } from "@/app/lib/subscription";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const subscriptionId = url.searchParams.get("id");
  const interval = url.searchParams.get("interval") || "monthly";
  const ref =
    url.searchParams.get("ref") || `TEST_RENEWAL_${Date.now()}`;

  if (!subscriptionId) {
    return NextResponse.json({ error: "missing id" }, { status: 400 });
  }

  await extendSubscriptionFromRenewal({
    subscriptionId,
    planInterval: interval,
    renewalReference: ref,
  });

  return NextResponse.json({ ok: true, ref });
}