"use client";

import { ReactNode } from "react";
import { useInView } from "@/app/lib/hooks/use-motion";

type Props = {
  children: ReactNode;
  className?: string;
  stagger?: boolean;
  delayMs?: number;
};

export default function Reveal({
  children,
  className = "",
  stagger = false,
  delayMs = 0,
}: Props) {
  const { ref, inView } = useInView<HTMLDivElement>();

  if (stagger) {
    return (
      <div
        ref={ref}
        data-inview={inView ? "true" : "false"}
        className={`lp-stagger ${className}`}
      >
        {children}
      </div>
    );
  }

  return (
    <div
      ref={ref}
      className={`lp-fade-up ${className}`}
      style={{
        animationDelay: `${delayMs}ms`,
        animationPlayState: inView ? "running" : "paused",
        opacity: inView ? undefined : 0,
      }}
    >
      {children}
    </div>
  );
}