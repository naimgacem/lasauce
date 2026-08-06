"use client";

import { m } from "framer-motion";
import { useLocale, useTranslations } from "next-intl";

import { formatConfidence } from "@/lib/format";

/**
 * Animated SVG confidence dial — the visual signature of the paid matcher.
 *
 * Deliberately thin. A heavy stroke reads as a progress bar (a thing that is
 * loading); a fine one reads as an instrument (a thing that is measuring),
 * which is the impression a paid score has to give. Animates once on reveal,
 * and not at all under prefers-reduced-motion via the global MotionConfig.
 */
export function ConfidenceRing({
  value,
  size = 64,
}: {
  /** 0..1 */
  value: number;
  size?: number;
}) {
  const t = useTranslations("matches");
  const locale = useLocale();
  //  Scales with the dial so a 56px card ring and a 96px detail ring keep the
  //  same proportions rather than one looking chunky.
  const stroke = Math.max(3, Math.round(size * 0.055));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(1, value));
  const gradientId = `premium-dial-${Math.round(clamped * 100)}`;

  return (
    <div
      className="relative inline-flex shrink-0 items-center justify-center"
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped * 100)}
      aria-label={t("confidenceAria", { value: formatConfidence(clamped, locale) })}
    >
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          {/* Three stops, highlight off-centre: the arc catches light as it
              travels, which is what separates brushed metal from a colour
              ramp. */}
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="hsl(var(--premium-from))" />
            <stop offset="38%" stopColor="hsl(var(--premium-via))" />
            <stop offset="100%" stopColor="hsl(var(--premium-to))" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          //  The unfilled remainder is a faint track, not a grey ring — at
          //  full muted weight it competes with the value arc for attention.
          className="stroke-foreground/[0.07]"
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
      {/* Tabular figures and tight tracking: the number should sit still when
          the score changes, and read as a measurement rather than as copy. */}
      <span className="absolute text-sm font-semibold tabular-nums tracking-tight">
        {formatConfidence(clamped, locale)}
      </span>
    </div>
  );
}
