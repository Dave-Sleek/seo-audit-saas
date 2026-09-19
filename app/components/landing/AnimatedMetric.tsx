"use client";

import { useCountUp, useInView } from "@/app/lib/hooks/use-motion";

type Props = {
  value: number;
  suffix?: string;
  prefix?: string;
  label: string;
  sublabel?: string;
  delta?: string;
  sparkline?: number[];
};

export default function AnimatedMetric({
  value,
  suffix = "",
  prefix = "",
  label,
  sublabel,
  delta,
  sparkline,
}: Props) {
  const { ref, inView } = useInView<HTMLDivElement>();
  const animated = useCountUp(value, { enabled: inView, duration: 1600 });

  const positive = delta ? !delta.startsWith("-") : false;

  return (
    <div ref={ref} className="flex flex-col items-center text-center">
      <div
        className="text-4xl font-bold tabular-nums tracking-[-0.03em] sm:text-5xl"
        style={{ color: "var(--text-primary)" }}
      >
        {prefix}
        {animated.toLocaleString()}
        {suffix}
      </div>

      <div
        className="mt-2 text-sm font-medium"
        style={{ color: "var(--text-secondary)" }}
      >
        {label}
      </div>

      {sublabel && (
        <div className="mt-1 text-xs" style={{ color: "var(--text-subtle)" }}>
          {sublabel}
        </div>
      )}

      {delta && (
        <div
          className="mt-3 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold"
          style={{
            background: positive
              ? "var(--success-light)"
              : "var(--danger-light)",
            color: positive ? "var(--success)" : "var(--danger)",
          }}
        >
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            {positive ? (
              <polyline points="6 15 12 9 18 15" />
            ) : (
              <polyline points="6 9 12 15 18 9" />
            )}
          </svg>
          {delta}
        </div>
      )}

      {sparkline && sparkline.length > 1 && (
        <Sparkline values={sparkline} animate={inView} />
      )}
    </div>
  );
}

/* =========================================================
   SPARKLINE
========================================================= */

function Sparkline({
  values,
  animate,
}: {
  values: number[];
  animate: boolean;
}) {
  const width = 120;
  const height = 36;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;

  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * width;
      const y = height - ((v - min) / range) * (height - 6) - 3;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="mt-4"
      aria-hidden="true"
    >
      <defs>
        <linearGradient
          id={`spark-fill-${values.join("-")}`}
          x1="0"
          y1="0"
          x2="0"
          y2="1"
        >
          <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.28" />
          <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
        </linearGradient>
      </defs>

      <polyline
        points={`0,${height} ${points} ${width},${height}`}
        fill={`url(#spark-fill-${values.join("-")})`}
        stroke="none"
      />

      <polyline
        points={points}
        fill="none"
        stroke="var(--primary)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="500"
        strokeDashoffset={animate ? 0 : 500}
        style={{
          transition: "stroke-dashoffset 1600ms cubic-bezier(0.22,1,0.36,1)",
        }}
      />
    </svg>
  );
}