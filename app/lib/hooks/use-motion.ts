"use client";

import { useEffect, useRef, useState } from "react";

/* =========================================================
   PREFERS REDUCED MOTION
========================================================= */

export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);

    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return reduced;
}

/* =========================================================
   IN-VIEW (fires once)
========================================================= */

export function useInView<T extends HTMLElement>(
  options: { threshold?: number; rootMargin?: string } = {}
) {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      {
        threshold: options.threshold ?? 0.15,
        rootMargin: options.rootMargin ?? "0px 0px -10% 0px",
      }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [options.threshold, options.rootMargin]);

  return { ref, inView };
}

/* =========================================================
   COUNT-UP
========================================================= */

export function useCountUp(
  target: number,
  opts: { duration?: number; enabled?: boolean } = {}
) {
  const { duration = 1200, enabled = true } = opts;
  const reduced = usePrefersReducedMotion();
  const [value, setValue] = useState(enabled && !reduced ? 0 : target);

  useEffect(() => {
    if (!enabled) return;
    if (reduced) {
      setValue(target);
      return;
    }

    let raf = 0;
    const start = performance.now();
    const from = 0;
    const delta = target - from;

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(from + delta * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, enabled, reduced]);

  return value;
}

/* =========================================================
   PARALLAX (subtle, on scroll)
========================================================= */

export function useParallax(strength: number = 0.15) {
  const [offset, setOffset] = useState(0);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    if (reduced) return;

    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        setOffset(window.scrollY * strength);
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [strength, reduced]);

  return offset;
}

/* =========================================================
   TYPE-OUT (character by character)
========================================================= */

export function useTypewriter(
  text: string,
  opts: { speed?: number; startDelay?: number; enabled?: boolean } = {}
) {
  const { speed = 55, startDelay = 600, enabled = true } = opts;
  const reduced = usePrefersReducedMotion();
  const [out, setOut] = useState(reduced ? text : "");

  useEffect(() => {
    if (!enabled) return;
    if (reduced) {
      setOut(text);
      return;
    }

    let i = 0;
    let timer: ReturnType<typeof setTimeout>;

    const start = setTimeout(() => {
      const tick = () => {
        i += 1;
        setOut(text.slice(0, i));
        if (i < text.length) {
          timer = setTimeout(tick, speed);
        }
      };
      tick();
    }, startDelay);

    return () => {
      clearTimeout(start);
      clearTimeout(timer);
    };
  }, [text, speed, startDelay, enabled, reduced]);

  return out;
}