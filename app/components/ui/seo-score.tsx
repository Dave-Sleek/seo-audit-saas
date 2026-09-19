interface SEOScoreProps {
  score: number;
  label?: string;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}

function getScoreInfo(score: number) {
  if (score >= 90) {
    return {
      label: "Excellent",
      text: "text-emerald-600",
      bg: "bg-emerald-50",
      border: "border-emerald-200",
    };
  }

  if (score >= 75) {
    return {
      label: "Good",
      text: "text-blue-600",
      bg: "bg-blue-50",
      border: "border-blue-200",
    };
  }

  if (score >= 50) {
    return {
      label: "Needs Improvement",
      text: "text-amber-600",
      bg: "bg-amber-50",
      border: "border-amber-200",
    };
  }

  return {
    label: "Poor",
    text: "text-red-600",
    bg: "bg-red-50",
    border: "border-red-200",
  };
}

export default function SEOScore({
  score,
  label,
  size = "md",
  showLabel = true,
}: SEOScoreProps) {
  const safeScore = Math.max(0, Math.min(100, Math.round(score)));

  const info = getScoreInfo(safeScore);

  const sizes = {
    sm: {
      wrapper: "h-20 w-20",
      score: "text-xl",
      label: "text-[10px]",
    },
    md: {
      wrapper: "h-28 w-28",
      score: "text-3xl",
      label: "text-xs",
    },
    lg: {
      wrapper: "h-40 w-40",
      score: "text-5xl",
      label: "text-sm",
    },
  };

  const currentSize = sizes[size];

  const circumference = 2 * Math.PI * 45;
  const offset =
    circumference - (safeScore / 100) * circumference;

  return (
    <div className="flex flex-col items-center">
      <div
        className={`relative ${currentSize.wrapper} flex items-center justify-center rounded-full`}
      >
        <svg
          className="absolute inset-0 h-full w-full -rotate-90"
          viewBox="0 0 100 100"
          aria-hidden="true"
        >
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="currentColor"
            strokeWidth="7"
            className="text-slate-100"
          />

          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="currentColor"
            strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className={info.text}
          />
        </svg>

        <div className="relative flex flex-col items-center">
          <span
            className={`font-bold tracking-tight text-slate-900 ${currentSize.score}`}
          >
            {safeScore}
          </span>

          <span className="text-xs text-slate-400">
            / 100
          </span>
        </div>
      </div>

      {showLabel && (
        <div
          className={`mt-3 rounded-full border px-3 py-1 ${info.bg} ${info.border}`}
        >
          <span
            className={`font-semibold ${info.text} ${currentSize.label}`}
          >
            {label || info.label}
          </span>
        </div>
      )}
    </div>
  );
}