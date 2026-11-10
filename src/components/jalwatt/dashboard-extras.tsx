import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Droplets, Gavel, Pause, Play, RotateCcw, ShieldCheck, XCircle, Zap } from "lucide-react";
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { evaluateJudgeTargets, type JalWattSettings, type SimulationResult } from "@/engine";
import { AnimatedNumber, chartTooltipStyle, hourLabel } from "./shared";

export function DashboardHero({ result, judgeMode, onToggleJudge, onPlayDemo, demoPlaying }: {
  result: SimulationResult;
  judgeMode: boolean;
  onToggleJudge: () => void;
  onPlayDemo: () => void;
  demoPlaying: boolean;
}) {
  const waterSaved = Math.max(0, result.baseline.waterL - result.jalwatt.waterL);
  const sla = result.jalwatt.slaViolations;
  return (
    <section className="hero-panel relative mb-6 overflow-hidden border border-primary/25 p-6 sm:p-8" aria-label="JalWatt overview">
      <div className="relative max-w-3xl">
        <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-primary"><span className="size-1.5 rounded-full bg-primary" />Water & energy aware AI scheduling</div>
        <h2 className="mt-3 text-2xl font-semibold leading-tight tracking-normal sm:text-4xl">Cut AI data-center power and water use. <span className="text-primary">Zero SLA violations.</span></h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">Bengaluru is one of India’s most water-stressed cities, and evaporative cooling drinks litres for every kWh of AI compute — JalWatt routes, reschedules and re-cools that work to save both.</p>
      </div>
      <div className="relative mt-6 flex flex-wrap gap-3">
        <HeroStat icon={Zap} label="energy saved" value={<><AnimatedNumber value={result.savingsPct} digits={1} />%</>} />
        <HeroStat icon={Droplets} label="litres of water saved / day" value={<AnimatedNumber value={waterSaved} digits={1} />} />
        <HeroStat icon={ShieldCheck} label="SLA violations" value={<>{sla}</>} tone={sla === 0 ? "ok" : "bad"} />
      </div>
      <div className="relative mt-6 flex flex-wrap gap-2">
        <Button onClick={onPlayDemo} disabled={demoPlaying}>{demoPlaying ? <Pause className="size-4" /> : <Play className="size-4" />}{demoPlaying ? "Demo playing…" : "Demo Mode · play a day"}</Button>
        <Button variant={judgeMode ? "default" : "outline"} aria-pressed={judgeMode} onClick={onToggleJudge}><Gavel className="size-4" />Judge Mode {judgeMode ? "on" : "off"}</Button>
      </div>
    </section>
  );
}

function HeroStat({ icon: Icon, label, value, tone = "ok" }: { icon: typeof Zap; label: string; value: React.ReactNode; tone?: "ok" | "bad" }) {
  return (
    <div className={`flex items-center gap-3 border bg-background/60 px-4 py-3 backdrop-blur ${tone === "ok" ? "border-primary/30" : "border-destructive/40"}`}>
      <Icon className={`size-4 ${tone === "ok" ? "text-primary" : "text-destructive"}`} />
      <div><div className={`font-mono text-xl font-semibold tabular-nums ${tone === "ok" ? "text-primary" : "text-destructive"}`}>{value}</div><div className="text-[11px] text-muted-foreground">{label}</div></div>
    </div>
  );
}

const DEMO_STEP_MS = 450;

export function DemoMode({ result, city, startToken, onPlayingChange }: { result: SimulationResult; city: string; startToken: number; onPlayingChange: (playing: boolean) => void }) {
  const [hour, setHour] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => { onPlayingChange(playing); }, [playing, onPlayingChange]);
  useEffect(() => {
    if (startToken === 0) return;
    setHour(0);
    setPlaying(true);
    panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [startToken]);
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      setHour((current) => {
        if (current >= 23) {
          setPlaying(false);
          return 24;
        }
        return current + 1;
      });
    }, DEMO_STEP_MS);
    return () => clearInterval(id);
  }, [playing]);

  const upto = Math.min(hour, 23);
  const seen = hour < 0 ? [] : result.hourlyProfile.slice(0, upto + 1);
  const sum = (pick: (h: SimulationResult["hourlyProfile"][number]) => number) => seen.reduce((total, h) => total + pick(h), 0);
  const counters = [
    { label: "Jobs processed", value: sum((h) => h.jalwattJobs), digits: 0 },
    { label: "Routed to smaller models", value: sum((h) => h.routedJobs), digits: 0 },
    { label: "Shifted to better hours", value: sum((h) => h.shiftedJobs), digits: 0 },
    { label: "Energy saved", value: sum((h) => h.baselineKWh - h.jalwattKWh), digits: 2, unit: "kWh" },
    { label: "Water saved by cooling", value: sum((h) => h.baselineWaterL - h.jalwattWaterL), digits: 1, unit: "L" },
  ];
  const data = result.hourlyProfile.map((h) => ({ ...h, baselineShown: h.hour <= upto ? h.baselineJobs : null, jalwattShown: h.hour <= upto ? h.jalwattJobs : null }));
  const now = result.hourlyProfile[Math.max(0, upto)];
  const done = hour >= 24;
  const idle = hour < 0;

  return (
    <section ref={panelRef} className="mb-6 scroll-mt-24 border border-border bg-card p-4 sm:p-5" aria-label="Demo mode">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <div className="text-sm font-semibold">Demo Mode · a day in a {city} server room</div>
          <div className="mt-1 text-xs text-muted-foreground" aria-live="polite">
            {idle ? "Play through 24 hours of scheduling decisions." : done ? "Day complete — every job finished within its window." : `${hourLabel(now?.hour ?? 0)} · ${now?.ambientTempC.toFixed(0)} °C · ₹${now?.tariffINR.toFixed(1)}/kWh · ${now?.routedJobs.toLocaleString("en-IN")} jobs right-sized, ${now?.shiftedJobs.toLocaleString("en-IN")} shifted in`}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-2xl tabular-nums text-primary" aria-label="Simulated clock">{idle ? "--:--" : hourLabel(done ? 23 : upto)}</span>
          {playing ? (
            <Button size="sm" variant="outline" onClick={() => setPlaying(false)}><Pause className="size-4" />Pause</Button>
          ) : (
            <Button size="sm" onClick={() => { if (idle || done) setHour(0); setPlaying(true); }}><Play className="size-4" />{idle ? "Play" : done ? "Replay" : "Resume"}</Button>
          )}
          {!idle && <Button size="sm" variant="ghost" aria-label="Reset demo" onClick={() => { setPlaying(false); setHour(-1); }}><RotateCcw className="size-4" /></Button>}
        </div>
      </div>
      <Progress value={idle ? 0 : ((Math.min(hour, 23) + 1) / 24) * 100} className="mt-4 h-1" aria-label="Demo progress" />
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-5">
        {counters.map((counter) => (
          <div key={counter.label} className="border border-border p-3">
            <div className="text-[11px] text-muted-foreground">{counter.label}</div>
            <div className="mt-1.5 font-mono text-lg tabular-nums">{<AnimatedNumber value={counter.value} digits={counter.digits} />}{counter.unit ? <span className="ml-1 text-[10px] text-muted-foreground">{counter.unit}</span> : null}</div>
          </div>
        ))}
      </div>
      <div className="mt-4 h-[240px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 5" vertical={false} />
            <XAxis dataKey="hour" tickFormatter={(h) => String(h).padStart(2, "0")} tickLine={false} axisLine={false} stroke="var(--color-muted-foreground)" fontSize={10} interval={2} />
            <YAxis yAxisId="jobs" tickLine={false} axisLine={false} stroke="var(--color-muted-foreground)" fontSize={10} width={42} />
            <YAxis yAxisId="conditions" orientation="right" tickLine={false} axisLine={false} stroke="var(--color-muted-foreground)" fontSize={10} width={34} />
            <Tooltip contentStyle={chartTooltipStyle} labelFormatter={(h) => hourLabel(Number(h))} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar yAxisId="jobs" dataKey="baselineShown" name="Baseline jobs" fill="var(--color-chart-2)" opacity={0.8} isAnimationActive={false} />
            <Bar yAxisId="jobs" dataKey="jalwattShown" name="JalWatt jobs" fill="var(--color-chart-1)" isAnimationActive={false} />
            <Line yAxisId="conditions" type="monotone" dataKey="ambientTempC" name="Ambient °C" stroke="var(--color-chart-3)" strokeWidth={1.5} dot={false} isAnimationActive={false} />
            <Line yAxisId="conditions" type="stepAfter" dataKey="tariffINR" name="Tariff ₹/kWh" stroke="var(--color-chart-4)" strokeWidth={1.5} dot={false} isAnimationActive={false} />
            {!idle && <ReferenceLine yAxisId="jobs" x={done ? 23 : upto} stroke="var(--color-primary)" strokeDasharray="4 3" />}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

export function JudgePanel({ settings, result, onOpenAssumptions }: { settings: JalWattSettings; result: SimulationResult; onOpenAssumptions: () => void }) {
  const checks = evaluateJudgeTargets(settings, result);
  const allMet = checks.every((check) => check.met);
  return (
    <section className="mb-6 border border-primary/40 bg-primary/5 p-5" aria-label="Judge Mode checklist">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold"><Gavel className="size-4 text-primary" />Judge Mode · problem-statement success metrics</div>
          <div className="mt-1 text-xs text-muted-foreground">Conservative preset: 10/10/80 enterprise mix, modest right-sizing, liquid closed-loop cooling.</div>
        </div>
        <span role="status" className={`inline-flex items-center gap-1.5 border px-2.5 py-1 font-mono text-xs font-semibold ${allMet ? "border-primary/40 bg-primary/10 text-primary" : "border-destructive/40 bg-destructive/10 text-destructive"}`}>{allMet ? <CheckCircle2 className="size-3.5" /> : <XCircle className="size-3.5" />}{allMet ? `All ${checks.length} targets met` : `${checks.filter((c) => !c.met).length} target(s) missed`}</span>
      </div>
      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        {checks.map((check) => (
          <li key={check.label} className="flex items-start justify-between gap-3 border border-border bg-card px-3 py-2.5 text-xs">
            <span className="flex items-start gap-2">{check.met ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" aria-label="Met" /> : <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" aria-label="Not met" />}<span><span className="font-medium">{check.label}</span><span className="block text-muted-foreground">Target {check.target}</span></span></span>
            <span className={`font-mono ${check.met ? "text-primary" : "text-destructive"}`}>{check.value}</span>
          </li>
        ))}
      </ul>
      <p className="mt-4 border-t border-primary/20 pt-3 text-[11px] text-muted-foreground">Simulated results; assumptions listed on the <button type="button" onClick={onOpenAssumptions} className="text-primary underline underline-offset-2">Assumptions page</button>.</p>
    </section>
  );
}
