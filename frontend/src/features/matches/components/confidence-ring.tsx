"use client";

import { m } from "framer-motion";

import { formatConfidence } from "@/lib/format";

/**
 * Animated SVG confidence ring — the visual signature of AI matching.
 * Stroke uses the reserved AI gradient; animates once on reveal (and not at
 * all under prefers-reduced-motion, via the global MotionConfig).
 */
export function ConfidenceRing({
  value,
  size = 64,
}: {
  /** 0..1 */
  value: number;
  size?: number;
}) {
  const stroke = 5;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(1, value));
  const gradientId = `ai-ring-${Math.round(clamped * 100)}`;

  return (
    <div
      className="relative inline-flex shrink-0 items-center justify-center"
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped * 100)}
      aria-label={`Match confidence ${formatConfidence(clamped)}`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="hsl(var(--ai-from))" />
            <stop offset="100%" stopColor="hsl(var(--ai-to))" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className="stroke-muted"
        />
        <m.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          stroke={`url(#${gradientId})`}
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          whileInView={{ strokeDashoffset: circumference * (1 - clamped) }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: "easeOut", delay: 0.15 }}
        />
      </svg>
      <span className="absolute text-sm font-bold tabular-nums">
        {formatConfidence(clamped)}
      </span>
    </div>
  );
}
