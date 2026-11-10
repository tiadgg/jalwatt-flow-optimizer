import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Flame, Loader2, RotateCcw, XCircle, Zap } from "lucide-react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { PEAK_TEST, runPeakLoad, type JalWattSettings, type SimulationResult } from "@/engine";
import { AnimatedNumber, AssumptionTag, chartTooltipStyle, hourLabel } from "./shared";

const STEP_MS = 260;

export function PeakLoadPanel({ settings, result }: { settings: JalWattSettings; result: SimulationResult }) {
  const peak = useMemo(() => runPeakLoad(settings, result), [settings, result]);
  const [shown, setShown] = useState<number | null>(null); // null = not run yet
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const total = peak.steps.length;
  const running = shown !== null && shown < total;
  const done = shown === total;

  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);
  // If inputs change after a run, show the recalculated result immediately.
  useEffect(() => { setShown((current) => (current === null || current < total ? current : total)); }, [peak, total]);

  const start = () => {
    if (timer.current) clearInterval(timer.current);
    setShown(0);
    timer.current = setInterval(() => {
      setShown((current) => {
        const next = (current ?? 0) + 1;
        if (next >= total && timer.current) clearInterval(timer.current);
        return Math.min(total, next);
      });
    }, STEP_MS);
  };

  const visible = peak.steps.slice(0, shown ?? 0);
  const currentStep = visible[visible.length - 1];
  const crashes = visible.filter((step) => step.crashed).length;
  const throttles = visible.filter((step) => step.throttled).length;
  const sla = visible.reduce((sum, step) => sum + step.overflowJobs, 0) + (visible.length ? result.jalwatt.slaViolations : 0);
  const chartData = peak.steps.map((step, index) => ({
    label: step.label,
    jalwatt: index < (shown ?? 0) ? Number(step.jalwattWattsPerTask.toFixed(3)) : null,
    baseline: index < (shown ?? 0) ? Number(step.baselineWattsPerTask.toFixed(3)) : null,
  }));
  const endHour = peak.startHour + PEAK_TEST.durationHours;

  return (
    <section className="mt-5 border border-border bg-card p-5 sm:p-6" aria-label="Peak load test">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold"><Flame className="size-4 text-chart-4" />Peak load test</div>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">
            {PEAK_TEST.durationHours}-hour peak in the hottest window ({hourLabel(peak.startHour)}–{hourLabel(endHour)}) at {PEAK_TEST.loadMultiplier}× normal jobs, with the rack held at its {settings.rackKW} kW maximum.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {done && <Button variant="ghost" size="sm" onClick={() => setShown(null)}><RotateCcw className="size-4" />Clear</Button>}
          <Button onClick={start} disabled={running}>
            {running ? <Loader2 className="size-4 animate-spin" /> : <Zap className="size-4" />}
            {running ? `Running… ${currentStep?.label ?? ""}` : done ? "Run again" : "Run peak load"}
          </Button>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <PeakMetric label="Server crashes" value={crashes} ok={crashes === 0} active={shown !== null} />
        <PeakMetric label="SLA violations" value={sla} ok={sla === 0} active={shown !== null} />
        <PeakMetric label="Thermal headroom" value={currentStep?.headroomPct ?? 0} digits={1} suffix="%" ok={(currentStep?.headroomPct ?? 100) >= PEAK_TEST.passMinHeadroomPct} active={shown !== null} />
        <PeakMetric label="Throttling events" value={throttles} ok={throttles === 0} active={shown !== null} />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 border border-border p-4">
          <div className="flex flex-wrap items-center justify-between gap-2"><div className="text-xs font-medium">Facility energy per task over the peak</div><span className="font-mono text-[10px] text-muted-foreground">Wh / task · 15-min steps</span></div>
          <div className="mt-3 h-[230px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 5" vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} stroke="var(--color-muted-foreground)" fontSize={10} interval={3} />
                <YAxis tickLine={false} axisLine={false} stroke="var(--color-muted-foreground)" fontSize={10} width={44} domain={[0, "auto"]} />
                <Tooltip contentStyle={chartTooltipStyle} formatter={(value, name) => [`${Number(value).toFixed(2)} Wh / task`, name]} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="baseline" name="Baseline" stroke="var(--color-chart-2)" strokeWidth={2} dot={false} isAnimationActive={false} connectNulls={false} />
                <Line type="monotone" dataKey="jalwatt" name="JalWatt" stroke="var(--color-chart-1)" strokeWidth={2} dot={false} isAnimationActive={false} connectNulls={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          {shown === null && <p className="mt-2 text-[11px] text-muted-foreground">Press Run peak load to play the 4-hour peak.</p>}
        </div>

        <div className="border border-border p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs font-medium">Result</div>
            {done ? (
              <span role="status" className={`inline-flex items-center gap-1.5 border px-2.5 py-1 font-mono text-xs font-semibold ${peak.pass ? "border-primary/40 bg-primary/10 text-primary" : "border-destructive/40 bg-destructive/10 text-destructive"}`}>
                {peak.pass ? <CheckCircle2 className="size-3.5" /> : <XCircle className="size-3.5" />}{peak.pass ? "PASS" : "FAIL"}
              </span>
            ) : (
              <span role="status" className="border border-border px-2.5 py-1 font-mono text-xs text-muted-foreground">{running ? "Running…" : "Not run"}</span>
            )}
          </div>
          <ul className="mt-4 grid gap-2.5 text-xs">
            {peak.criteria.map((criterion) => (
              <li key={criterion.label} className="flex items-start justify-between gap-3">
                <span className="flex items-start gap-2">
                  {done ? criterion.met ? <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-primary" /> : <XCircle className="mt-0.5 size-3.5 shrink-0 text-destructive" /> : <span className="mt-1 size-2.5 shrink-0 rounded-full border border-border" />}
                  <span>{criterion.label} <span className="text-muted-foreground">{criterion.target}</span></span>
                </span>
                <span className="font-mono text-muted-foreground">{done ? criterion.value : "—"}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-3 text-[10px] leading-4 text-muted-foreground">
            Cooling sized at {PEAK_TEST.coolingDesignMargin}× rack kW, derated {PEAK_TEST.deratePctPerC}%/°C above {PEAK_TEST.derateAboveC} °C. <AssumptionTag />
          </div>
        </div>
      </div>
    </section>
  );
}

function PeakMetric({ label, value, digits = 0, suffix = "", ok, active }: { label: string; value: number; digits?: number; suffix?: string; ok: boolean; active: boolean }) {
  return (
    <div className={`border p-4 transition-colors ${active ? (ok ? "border-primary/30 bg-primary/5" : "border-destructive/40 bg-destructive/5") : "border-border"}`}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-2 font-mono text-2xl tabular-nums ${active ? (ok ? "text-primary" : "text-destructive") : "text-muted-foreground"}`}>
        {active ? <AnimatedNumber value={value} digits={digits} /> : "—"}{active ? suffix : ""}
      </div>
    </div>
  );
}
