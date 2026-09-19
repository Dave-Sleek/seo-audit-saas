"use client";

import { useCountUp, useInView } from "@/app/lib/hooks/use-motion";

type Props = {
  value: number;
  suffix?: string;
  label: string;
};

export default function StatCard({ value, suffix = "", label }: Props) {
  const { ref, inView } = useInView<HTMLDivElement>();
  const animated = useCountUp(value, { enabled: inView, duration: 1400 });

  return (
    <div ref={ref}>
      <p
        className="text-4xl font-bold tabular-nums tracking-tight"
        style={{ color: "var(--text-primary)" }}
      >
        {animated}
        {suffix}
      </p>
      <p
        className="mt-2 text-sm"
        style={{ color: "var(--text-muted)" }}
      >
        {label}
      </p>
    </div>
  );
}