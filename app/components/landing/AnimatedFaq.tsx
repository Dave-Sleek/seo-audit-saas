"use client";

import { useState } from "react";

type Props = {
  faqs: { question: string; answer: string }[];
};

export default function AnimatedFaq({ faqs }: Props) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div
      className="overflow-hidden rounded-2xl border"
      style={{
        background: "var(--surface)",
        borderColor: "var(--border)",
      }}
    >
      {faqs.map((faq, i) => {
        const isOpen = openIndex === i;

        return (
          <div
            key={faq.question}
            className="border-b last:border-b-0"
            style={{ borderColor: "var(--border-light)" }}
          >
            <button
              type="button"
              onClick={() => setOpenIndex(isOpen ? null : i)}
              className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left transition-colors hover:bg-slate-50/60"
              aria-expanded={isOpen}
            >
              <span
                className="text-sm font-semibold"
                style={{ color: "var(--text-primary)" }}
              >
                {faq.question}
              </span>

              <span
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-transform duration-300"
                style={{
                  background: isOpen
                    ? "var(--primary)"
                    : "var(--border-light)",
                  color: isOpen ? "#fff" : "var(--text-muted)",
                  transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                }}
                aria-hidden="true"
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </span>
            </button>

            <div
              className="grid overflow-hidden transition-[grid-template-rows] duration-300 ease-out"
              style={{
                gridTemplateRows: isOpen ? "1fr" : "0fr",
              }}
            >
              <div className="min-h-0">
                <p
                  className="px-6 pb-5 text-sm leading-6"
                  style={{ color: "var(--text-muted)" }}
                >
                  {faq.answer}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}