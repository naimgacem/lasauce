"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";

import { formatDayMonth, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { DailyActivity } from "@/types/admin";

const HEIGHT = 220;
const MARGIN = { top: 12, right: 4, bottom: 26, left: 32 };
/** Bars never fill their slot; the leftover is air. */
const MAX_BAR = 24;
/** Surface gap between stacked segments. */
const GAP = 2;
const RADIUS = 4;

/** Clean tick steps (1, 2, 5 × 10ⁿ) giving about four gridlines. */
function niceScale(max: number): { top: number; ticks: number[] } {
  if (max <= 0) return { top: 1, ticks: [0, 1] };
  const rough = max / 4;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 5, 10].map((m) => m * magnitude).find((s) => s >= rough) ?? magnitude * 10;
  const unit = Math.max(1, step);
  const top = Math.ceil(max / unit) * unit;
  const ticks: number[] = [];
  for (let v = 0; v <= top; v += unit) ticks.push(v);
  return { top, ticks };
}

/** A column rounded at its data end and square at the baseline. */
function topRoundedRect(x: number, y: number, w: number, h: number): string {
  const r = Math.min(RADIUS, h, w / 2);
  return [
    `M${x},${y + h}`,
    `V${y + r}`,
    `Q${x},${y} ${x + r},${y}`,
    `H${x + w - r}`,
    `Q${x + w},${y} ${x + w},${y + r}`,
    `V${y + h}`,
    "Z",
  ].join(" ");
}

function useWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = React.useRef<T>(null);
  const [width, setWidth] = React.useState(0);
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(el);
    setWidth(el.getBoundingClientRect().width);
    return () => observer.disconnect();
  }, []);
  return [ref, width];
}

/**
 * New reports per day, lost stacked under found.
 *
 * Lost and found are the product's own semantic pair (rose ↔ teal), drawn with
 * the `--chart-*` steps that pass the categorical colour checks. Sign-ups are a
 * different measure and would need a second axis, so they are a figure in the
 * panel header rather than a third series here.
 *
 * Laid out left-to-right in every locale: it is a time axis, and the figures
 * on it are Latin digits in all three languages.
 */
export function ActivityChart({
  data,
  refreshing = false,
}: {
  data: DailyActivity[];
  refreshing?: boolean;
}) {
  const t = useTranslations("admin.overview.chart");
  const tc = useTranslations("common");
  const locale = useLocale();
  const [frameRef, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = React.useState<number | null>(null);

  const totals = data.map((d) => d.lost + d.found);
  const { top, ticks } = niceScale(Math.max(0, ...totals));
  const empty = totals.every((v) => v === 0);

  const plotW = Math.max(0, width - MARGIN.left - MARGIN.right);
  const plotH = HEIGHT - MARGIN.top - MARGIN.bottom;
  const band = data.length ? plotW / data.length : 0;
  const barW = Math.max(2, Math.min(MAX_BAR, band * 0.64));
  const y = (value: number) => MARGIN.top + plotH - (value / top) * plotH;

  //  Label about once a week, always including today, so the newest bar is named.
  const labelEvery = Math.max(1, Math.ceil(data.length / 5));
  const isLabelled = (i: number) => (data.length - 1 - i) % labelEvery === 0;

  function onKeyDown(event: React.KeyboardEvent) {
    if (!data.length) return;
    const last = data.length - 1;
    const current = active ?? last;
    const next =
      event.key === "ArrowRight"
        ? Math.min(last, current + 1)
        : event.key === "ArrowLeft"
          ? Math.max(0, current - 1)
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? last
              : null;
    if (next === null) return;
    event.preventDefault();
    setActive(next);
  }

  const activeDay = active !== null ? data[active] : null;
  const tooltipX = active !== null ? MARGIN.left + band * active + band / 2 : 0;

  return (
    <div dir="ltr" className="space-y-3">
      <div className="flex items-center gap-4 text-caption font-normal text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-[2px] bg-chart-lost" aria-hidden />
          {tc("lost")}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-[2px] bg-chart-found" aria-hidden />
          {tc("found")}
        </span>
      </div>

      <div
        ref={frameRef}
        role="group"
        tabIndex={0}
        aria-label={t("aria")}
        aria-roledescription={t("roleDescription")}
        onKeyDown={onKeyDown}
        onFocus={() => setActive((current) => current ?? data.length - 1)}
        onBlur={() => setActive(null)}
        className={cn(
          "relative rounded-md transition-opacity duration-200 focus-visible:ring-offset-4",
          refreshing && "opacity-60",
        )}
        style={{ height: HEIGHT }}
      >
        {width > 0 ? (
          <svg
            width={width}
            height={HEIGHT}
            className="block overflow-visible"
            onPointerLeave={() => setActive(null)}
            aria-hidden
          >
            {ticks.map((tick) => (
              <g key={tick}>
                <line
                  x1={MARGIN.left}
                  x2={width - MARGIN.right}
                  y1={y(tick)}
                  y2={y(tick)}
                  className="stroke-border"
                  strokeWidth={1}
                  shapeRendering="crispEdges"
                />
                <text
                  x={MARGIN.left - 8}
                  y={y(tick)}
                  textAnchor="end"
                  dominantBaseline="middle"
                  className="fill-muted-foreground text-[11px] tabular-nums"
                >
                  {formatNumber(tick, locale)}
                </text>
              </g>
            ))}

            {data.map((day, i) => {
              const x = MARGIN.left + band * i + (band - barW) / 2;
              const lostH = (day.lost / top) * plotH;
              const foundH = (day.found / top) * plotH;
              const both = day.lost > 0 && day.found > 0;
              const baseline = MARGIN.top + plotH;
              const dimmed = active !== null && active !== i;
              return (
                <g
                  key={day.date}
                  className="transition-opacity duration-150"
                  opacity={dimmed ? 0.4 : 1}
                >
                  {day.lost > 0 ? (
                    <path
                      d={
                        both
                          ? `M${x},${baseline} V${baseline - lostH} H${x + barW} V${baseline} Z`
                          : topRoundedRect(x, baseline - lostH, barW, lostH)
                      }
                      className="fill-chart-lost"
                    />
                  ) : null}
                  {day.found > 0 ? (
                    <path
                      d={topRoundedRect(
                        x,
                        baseline - lostH - (both ? GAP : 0) - foundH,
                        barW,
                        foundH,
                      )}
                      className="fill-chart-found"
                    />
                  ) : null}
                  {isLabelled(i) ? (
                    <text
                      x={MARGIN.left + band * i + band / 2}
                      y={HEIGHT - 6}
                      textAnchor="middle"
                      className="fill-muted-foreground text-[11px]"
                    >
                      {formatDayMonth(day.date, locale)}
                    </text>
                  ) : null}
                  {/* The whole day's column is the hit target, not the painted pixels. */}
                  <rect
                    x={MARGIN.left + band * i}
                    y={MARGIN.top}
                    width={band}
                    height={plotH}
                    fill="transparent"
                    onPointerEnter={() => setActive(i)}
                  />
                </g>
              );
            })}
          </svg>
        ) : null}

        {empty && width > 0 ? (
          <p className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-body-sm text-muted-foreground">
            {t("empty")}
          </p>
        ) : null}

        {activeDay ? (
          <div
            className="pointer-events-none absolute top-0 z-10 w-max min-w-[9rem] -translate-x-1/2 rounded-lg border bg-popover px-3 py-2 text-caption font-normal text-popover-foreground shadow-md"
            style={{
              left: Math.min(Math.max(tooltipX, 72), Math.max(72, width - 72)),
            }}
          >
            <p className="mb-1.5 text-muted-foreground">{formatDayMonth(activeDay.date, locale)}</p>
            {(
              [
                ["lost", activeDay.lost, "bg-chart-lost"],
                ["found", activeDay.found, "bg-chart-found"],
              ] as const
            ).map(([key, value, swatch]) => (
              <p key={key} className="flex items-center gap-2">
                <span className={cn("h-0.5 w-3 rounded-full", swatch)} aria-hidden />
                <span className="font-semibold tabular-nums text-foreground">
                  {formatNumber(value, locale)}
                </span>
                <span className="text-muted-foreground">{tc(key)}</span>
              </p>
            ))}
            {activeDay.signups > 0 ? (
              <p className="mt-1 border-t pt-1 text-muted-foreground">
                {t("signups", { count: activeDay.signups })}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* What the tooltip shows, spoken: keyboard users move day by day with
          the arrow keys and hear each one. */}
      <p className="sr-only" aria-live="polite">
        {activeDay
          ? t("announce", {
              day: formatDayMonth(activeDay.date, locale),
              lost: activeDay.lost,
              found: activeDay.found,
            })
          : ""}
      </p>

      {/* The same numbers without the picture. */}
      <table className="sr-only">
        <caption>{t("aria")}</caption>
        <thead>
          <tr>
            <th scope="col">{t("day")}</th>
            <th scope="col">{tc("lost")}</th>
            <th scope="col">{tc("found")}</th>
          </tr>
        </thead>
        <tbody>
          {data.map((day) => (
            <tr key={day.date}>
              <th scope="row">{formatDayMonth(day.date, locale)}</th>
              <td>{day.lost}</td>
              <td>{day.found}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
