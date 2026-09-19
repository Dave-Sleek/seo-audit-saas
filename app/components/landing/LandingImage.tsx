"use client";

import { ReactNode } from "react";

type Props = {
  label: string;
  ratio?: "16/9" | "4/3" | "1/1" | "3/2";
  tone?: "primary" | "neutral" | "dark";
  icon?: ReactNode;
  className?: string;
};

export default function LandingImage({
  label,
  ratio = "16/9",
  tone = "primary",
  icon,
  className = "",
}: Props) {
  const ratioMap: Record<string, string> = {
    "16/9": "56.25%",
    "4/3": "75%",
    "1/1": "100%",
    "3/2": "66.66%",
  };

  const bg =
    tone === "primary"
      ? "linear-gradient(135deg, #fff7ed 0%, #ffedd5 45%, #fed7aa 100%)"
      : tone === "dark"
        ? "linear-gradient(135deg, #1a0f08 0%, #2a1408 60%, #3a1a0c 100%)"
        : "linear-gradient(135deg, #f8fafc 0%, #eef2f7 100%)";

  const fg =
    tone === "dark"
      ? "rgba(255, 237, 213, 0.85)"
      : tone === "primary"
        ? "#c2410c"
        : "#475569";

  const borderColor =
    tone === "dark"
      ? "rgba(255,255,255,0.08)"
      : "var(--border)";

  return (
    <div
      className={`lp-image-placeholder relative w-full overflow-hidden rounded-2xl border ${className}`}
      style={{
        background: bg,
        borderColor,
        paddingBottom: ratioMap[ratio],
      }}
      aria-label={label}
      role="img"
    >
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
        {icon && (
          <div
            className="flex h-14 w-14 items-center justify-center rounded-2xl"
            style={{
              background:
                tone === "dark"
                  ? "rgba(255,255,255,0.06)"
                  : "rgba(255,255,255,0.75)",
              color: fg,
            }}
          >
            {icon}
          </div>
        )}

        <div
          className="text-xs font-semibold uppercase tracking-wider"
          style={{ color: fg }}
        >
          {label}
        </div>
      </div>

      {/* Shimmer */}
      <div
        className="lp-image-shimmer pointer-events-none absolute inset-0"
        aria-hidden="true"
      />
    </div>
  );
}