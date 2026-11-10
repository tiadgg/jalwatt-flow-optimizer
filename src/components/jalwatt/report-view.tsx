import { CheckCircle2, Download, FileText, Printer, TriangleAlert } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import type { JalWattSettings, SimulationResult } from "@/engine";
import { buildAssumptionRows } from "@/lib/assumptions";
import { chartTooltipStyle, money, pctSaved, StatusTag } from "./shared";

const ROADMAP = [
  { title: "Lab pilot", detail: "Run JalWatt alongside a live server room and compare against metered results." },
  { title: "GPU/PDU telemetry integration", detail: "Replace modelled Wh per task with measured GPU and PDU power." },
  { title: "Renewable-aware scheduling", detail: "Shift flexible jobs toward hours with more solar and wind on the grid." },
  { title: "Heat reuse", detail: "Route liquid-loop waste heat to water heating or nearby buildings." },
];

export function ReportView({ settings, result, exportReport }: { settings: JalWattSettings; result: SimulationResult; exportReport: () => void }) {
  const rows = [
    { label: "IT energy", baseline: result.baseline.itKWh, jalwatt: result.jalwatt.itKWh, unit: "kWh" },
    { label: "Facility energy", baseline: result.baseline.facilityKWh, jalwatt: result.jalwatt.facilityKWh, unit: "kWh" },
    { label: "Water use", baseline: result.baseline.waterL, jalwatt: result.jalwatt.waterL, unit: "L" },
    { label: "Carbon emissions", baseline: result.baseline.co2Kg, jalwatt: result.jalwatt.co2Kg, unit: "kg CO₂" },
    { label: "Energy cost", baseline: result.baseline.costINR, jalwatt: result.jalwatt.costINR, unit: "INR" },
    { label: "SLA violations", baseline: result.baseline.slaViolations, jalwatt: result.jalwatt.slaViolations, unit: "" },
  ];
  const comparison = rows.slice(1, 5).map((row) => ({ label: row.label.replace(" emissions", "").replace(" use", ""), Baseline: 100, JalWatt: row.baseline > 0 ? Number(((row.jalwatt / row.baseline) * 100).toFixed(1)) : 0 }));
  const cooling = settings.cooling[settings.selectedCooling];
  const inputs = [
    ["City", settings.city],
    ["Workload source", settings.telemetry ? "Uploaded telemetry" : "Simulated"],
    ["Jobs per day", result.guarantees.totalJobs.toLocaleString("en-IN")],
    ["Mix easy / medium / hard", `${settings.mix.easy} / ${settings.mix.medium} / ${settings.mix.hard} %`],
    ["Deferrable / privacy-pinned", `${settings.deferrablePct}% / ${settings.privacyPinnedPct}%`],
    ["Deadline window", `${settings.deadlineHours} h`],
    ["Room / rack capacity", `${settings.roomKW} kW / ${settings.rackKW} kW`],
    ["Cooling", `${settings.selectedCooling[0]?.toUpperCase()}${settings.selectedCooling.slice(1)} · PUE ${cooling.pue} · WUE ${cooling.wue}`],
    ["Seed", String(settings.seed)],
  ];
  const assumptions = buildAssumptionRows(settings);
  const date = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });

  return (
    <article className="report-print mx-auto max-w-5xl">
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-primary"><FileText className="size-3.5" />Scenario report</div>
          <h2 className="mt-2 text-2xl font-semibold tracking-normal sm:text-3xl">JalWatt — water & energy aware scheduling report</h2>
          <p className="mt-1 text-sm text-muted-foreground">{settings.city} server room · generated {date}</p>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <Button variant="outline" onClick={exportReport}><Download className="size-4" />CSV</Button>
          <Button onClick={() => window.print()}><Printer className="size-4" />Download PDF</Button>
        </div>
      </div>

      <ReportSection title="1. Scenario inputs">
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
          {inputs.map(([label, value]) => <div key={label} className="border-b border-border/60 pb-2"><dt className="text-[11px] text-muted-foreground">{label}</dt><dd className="mt-0.5 font-mono text-sm">{value}</dd></div>)}
        </dl>
      </ReportSection>

      <ReportSection title="2. Baseline vs JalWatt results (per day)">
        <div className="overflow-x-auto"><table className="w-full min-w-[520px] text-left text-sm"><thead><tr className="border-b border-border text-xs text-muted-foreground"><th className="pb-3 font-medium">Metric</th><th className="pb-3 text-right font-medium">Baseline</th><th className="pb-3 text-right font-medium">JalWatt</th><th className="pb-3 text-right font-medium">Saved</th></tr></thead>
          <tbody>{rows.map((row) => <tr key={row.label} className="border-b border-border/60"><td className="py-3">{row.label}</td><td className="py-3 text-right font-mono text-muted-foreground">{row.unit === "INR" ? money(row.baseline) : row.baseline.toFixed(row.unit ? 2 : 0)} <span className="text-[10px]">{row.unit === "INR" ? "" : row.unit}</span></td><td className="py-3 text-right font-mono">{row.unit === "INR" ? money(row.jalwatt) : row.jalwatt.toFixed(row.unit ? 2 : 0)} <span className="text-[10px] text-muted-foreground">{row.unit === "INR" ? "" : row.unit}</span></td><td className="py-3 text-right font-mono text-primary">{row.unit ? `${pctSaved(row.baseline, row.jalwatt).toFixed(1)}%` : "—"}</td></tr>)}</tbody></table></div>
        <p className="mt-3 text-xs text-muted-foreground">Facility energy saving: <strong className="font-mono text-primary">{result.savingsPct.toFixed(1)}%</strong> · Jobs shifted: <strong className="font-mono text-foreground">{result.guarantees.shiftedJobs.toLocaleString("en-IN")}</strong> · Privacy-pinned moved: <strong className="font-mono text-foreground">{result.guarantees.pinnedMoved}</strong></p>
      </ReportSection>

      <ReportSection title="3. Charts">
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="report-chart border border-border p-3"><div className="text-xs font-medium">Hourly facility energy (kWh)</div><div className="mt-2 h-[220px] w-full"><ResponsiveContainer width="100%" height="100%"><BarChart data={result.hourlyProfile} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}><CartesianGrid stroke="var(--color-border)" strokeDasharray="3 5" vertical={false} /><XAxis dataKey="hour" tickLine={false} axisLine={false} stroke="var(--color-muted-foreground)" fontSize={10} interval={3} /><YAxis tickLine={false} axisLine={false} stroke="var(--color-muted-foreground)" fontSize={10} width={44} /><Tooltip contentStyle={chartTooltipStyle} /><Legend wrapperStyle={{ fontSize: 10 }} /><Bar dataKey="baselineKWh" name="Baseline" fill="var(--color-chart-2)" isAnimationActive={false} /><Bar dataKey="jalwattKWh" name="JalWatt" fill="var(--color-chart-1)" isAnimationActive={false} /></BarChart></ResponsiveContainer></div></div>
          <div className="report-chart border border-border p-3"><div className="text-xs font-medium">JalWatt as % of baseline</div><div className="mt-2 h-[220px] w-full"><ResponsiveContainer width="100%" height="100%"><BarChart data={comparison} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}><CartesianGrid stroke="var(--color-border)" strokeDasharray="3 5" vertical={false} /><XAxis dataKey="label" tickLine={false} axisLine={false} stroke="var(--color-muted-foreground)" fontSize={10} /><YAxis tickLine={false} axisLine={false} stroke="var(--color-muted-foreground)" fontSize={10} width={44} domain={[0, 100]} /><Tooltip contentStyle={chartTooltipStyle} formatter={(value) => `${value}%`} /><Legend wrapperStyle={{ fontSize: 10 }} /><Bar dataKey="Baseline" fill="var(--color-chart-2)" isAnimationActive={false} /><Bar dataKey="JalWatt" fill="var(--color-chart-1)" isAnimationActive={false} /></BarChart></ResponsiveContainer></div></div>
        </div>
      </ReportSection>

      <ReportSection title="4. Decision log summary">
        <div className="divide-y divide-border">{result.decisionLog.map((item) => <div key={item.jobGroup} className="grid gap-1 py-2.5 sm:grid-cols-[170px_1fr_150px]"><span className="text-xs font-medium">{item.jobGroup}</span><span className="text-xs text-muted-foreground">{item.reason}</span><span className="text-xs text-primary sm:text-right">{item.action}</span></div>)}</div>
      </ReportSection>

      <ReportSection title="5. Assumptions">
        <div className="grid gap-x-6 sm:grid-cols-2">{assumptions.map((row) => <div key={row.name} className="flex items-start justify-between gap-3 border-b border-border/60 py-2 text-xs"><span><span className="text-foreground">{row.name}</span><span className="block font-mono text-[11px] text-muted-foreground">{row.value}</span></span><StatusTag status={row.status} /></div>)}</div>
      </ReportSection>

      <section className="report-section mt-5 border border-chart-3/40 bg-chart-3/5 p-5">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-chart-3"><TriangleAlert className="size-4" />6. Limitations</h3>
        <p className="mt-2 text-sm">Simulated results; real validation requires a lab pilot with live telemetry.</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">Per-task energy, cooling efficiency, tariffs and grid carbon are modelled values marked “To verify”. Capacity limits beyond the peak-load test are not modelled.</p>
      </section>

      <section className="report-section mt-5 border border-primary/30 bg-primary/5 p-5">
        <h3 className="text-sm font-semibold text-primary">7. Roadmap</h3>
        <ol className="mt-3 grid gap-3 sm:grid-cols-2">{ROADMAP.map((item, index) => <li key={item.title} className="flex gap-3"><span className="grid size-6 shrink-0 place-items-center border border-primary/40 font-mono text-[11px] text-primary">{index + 1}</span><span><span className="flex items-center gap-1.5 text-sm font-medium"><CheckCircle2 className="size-3.5 text-primary" />{item.title}</span><span className="mt-0.5 block text-xs leading-5 text-muted-foreground">{item.detail}</span></span></li>)}</ol>
      </section>
    </article>
  );
}

function ReportSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="report-section mt-5 border border-border bg-card p-5 first:mt-0">
      <h3 className="mb-4 text-sm font-semibold">{title}</h3>
      {children}
    </section>
  );
}
