import { useEffect, useRef, useState } from "react";

export const money = (value: number) => `₹${Math.round(value).toLocaleString("en-IN")}`;
export const energy = (value: number) => `${value.toFixed(2)} kWh`;
export const formatCompact = (value: number) =>
  new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 }).format(value);
export const hourLabel = (hour: number) => `${String(hour).padStart(2, "0")}:00`;
export const pctSaved = (baseline: number, optimized: number) => (baseline > 0 ? ((baseline - optimized) / baseline) * 100 : 0);

export const chartTooltipStyle = {
  background: "var(--color-popover)",
  border: "1px solid var(--color-border)",
  borderRadius: "4px",
  color: "var(--color-foreground)",
} as const;

export function AssumptionTag() {
  return (
    <span className="inline-flex shrink-0 items-center border border-border px-1.5 py-0.5 text-[9px] font-medium uppercase text-muted-foreground">
      Assumption
    </span>
  );
}

export function StatusTag({ status }: { status: "Assumption" | "To verify" }) {
  return status === "To verify" ? (
    <span className="inline-flex shrink-0 items-center border border-chart-3/40 bg-chart-3/10 px-1.5 py-0.5 text-[9px] font-medium uppercase text-chart-3">
      To verify
    </span>
  ) : (
    <AssumptionTag />
  );
}

export function PanelHeading({ eyebrow, title, description, actions }: { eyebrow: string; title: string; description: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">{eyebrow}</div>
        <h2 className="mt-2 text-xl font-semibold tracking-normal sm:text-2xl">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Smoothly animates a number toward its target; respects reduced-motion. */
export function useAnimatedNumber(target: number, durationMs = 600) {
  const [value, setValue] = useState(target);
  const fromRef = useRef(target);
  useEffect(() => {
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce || durationMs <= 0) {
      fromRef.current = target;
      setValue(target);
      return;
    }
    const from = fromRef.current;
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - (1 - t) ** 3;
      const next = from + (target - from) * eased;
      fromRef.current = next;
      setValue(next);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, durationMs]);
  return value;
}

export function AnimatedNumber({ value, digits = 0, format }: { value: number; digits?: number; format?: (value: number) => string }) {
  const animated = useAnimatedNumber(value);
  return <>{format ? format(animated) : animated.toLocaleString("en-IN", { minimumFractionDigits: digits, maximumFractionDigits: digits })}</>;
}
