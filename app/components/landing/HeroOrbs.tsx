"use client";

import { useParallax } from "@/app/lib/hooks/use-motion";

export default function HeroOrbs() {
  const slow = useParallax(0.08);
  const fast = useParallax(0.14);

  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden="true"
    >
      {/* Base radial — orange wash */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(1200px 600px at 50% 0%, rgba(249,115,22,0.22), transparent 60%)",
        }}
      />

      {/* Drifting grid */}
      <div className="lp-grid-drift lp-hero-grid absolute inset-0" />

      {/* Orb A — amber → orange → red-orange */}
      <div
        className="lp-orb-a absolute -left-40 top-20 h-[520px] w-[520px] rounded-full opacity-70 blur-3xl"
        style={{
          background:
            "conic-gradient(from 180deg at 50% 50%, #f97316 0deg, #fbbf24 120deg, #ef4444 240deg, #f97316 360deg)",
          transform: `translateY(${slow}px)`,
          mixBlendMode: "screen",
        }}
      />

      {/* Orb B — deeper orange ↔ warm yellow */}
      <div
        className="lp-orb-b absolute -right-40 top-40 h-[420px] w-[420px] rounded-full opacity-60 blur-3xl"
        style={{
          background:
            "conic-gradient(from 90deg at 50% 50%, #ea580c 0deg, #f59e0b 180deg, #fb923c 360deg)",
          transform: `translateY(${fast}px)`,
          mixBlendMode: "screen",
        }}
      />

      {/* Vignette to keep text readable */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(10,14,26,0) 0%, rgba(10,14,26,0.6) 100%)",
        }}
      />
    </div>
  );
}