import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import type { JalWattSettings } from "@/engine";
import { buildAssumptionRows, type AssumptionStatus } from "@/lib/assumptions";
import { PanelHeading, StatusTag } from "./shared";

const METHOD = [
  ["Baseline", "Every task runs on the large model at its arrival hour with evaporative cooling."],
  ["JalWatt", "Easy → small model, medium → medium, hard → large. Deferrable jobs move to the cheapest/coolest hour before their deadline; privacy-pinned jobs stay local; urgent jobs are never delayed."],
  ["Formulas", "Facility kWh = IT kWh × PUE · Water L = IT kWh × WUE · CO₂ = facility kWh × grid factor · Cost = Σ hourly facility kWh × tariff."],
  ["Telemetry", "When a CSV is uploaded, measured IT kWh per hour is the baseline and right-sizing scales each job by its model's energy ratio to the large model."],
];

export function AssumptionsView({ settings }: { settings: JalWattSettings }) {
  const rows = useMemo(() => buildAssumptionRows(settings), [settings]);
  const [filter, setFilter] = useState<"All" | AssumptionStatus>("All");
  const shown = rows.filter((row) => filter === "All" || row.status === filter);
  const counts = { All: rows.length, Assumption: rows.filter((row) => row.status === "Assumption").length, "To verify": rows.filter((row) => row.status === "To verify").length };
  return (
    <>
      <PanelHeading eyebrow="Model documentation" title="Assumptions & methodology" description="Every constant behind the estimates, with its current value and whether it still needs real-world verification." />
      <div className="mb-4 flex flex-wrap items-center gap-2" role="group" aria-label="Filter by status">
        {(["All", "Assumption", "To verify"] as const).map((option) => <Button key={option} size="sm" variant={filter === option ? "default" : "outline"} aria-pressed={filter === option} onClick={() => setFilter(option)}>{option} <span className="font-mono text-[10px] opacity-70">{counts[option]}</span></Button>)}
        <span className="ml-auto flex items-center gap-3 text-[11px] text-muted-foreground"><span className="flex items-center gap-1.5"><StatusTag status="Assumption" />modelling choice</span><span className="flex items-center gap-1.5"><StatusTag status="To verify" />needs real data</span></span>
      </div>
      <section className="overflow-x-auto border border-border bg-card p-4 sm:p-5">
        <table className="w-full min-w-[760px] text-left text-xs">
          <thead><tr className="border-b border-border text-muted-foreground"><th className="px-2 py-3 font-medium">Area</th><th className="px-2 py-3 font-medium">Constant</th><th className="px-2 py-3 font-medium">Current value</th><th className="px-2 py-3 font-medium">Status</th><th className="px-2 py-3 font-medium">Note</th></tr></thead>
          <tbody>{shown.map((row) => <tr key={row.name} className="border-b border-border/60 align-top"><td className="px-2 py-3 text-muted-foreground">{row.group}</td><td className="px-2 py-3 font-medium">{row.name}</td><td className="px-2 py-3 font-mono">{row.value}</td><td className="px-2 py-3"><StatusTag status={row.status} /></td><td className="px-2 py-3 leading-5 text-muted-foreground">{row.note}</td></tr>)}</tbody>
        </table>
      </section>
      <section className="mt-5 border border-border bg-card px-5"><div className="divide-y divide-border">{METHOD.map(([title, detail]) => <div key={title} className="grid gap-2 py-4 sm:grid-cols-[160px_1fr]"><div className="text-xs font-semibold">{title}</div><p className="text-xs leading-5 text-muted-foreground">{detail}</p></div>)}</div></section>
      <div className="mt-5 border border-chart-3/30 bg-chart-3/5 p-4 text-xs leading-5 text-muted-foreground"><span className="font-medium text-chart-3">Important:</span> Simulated results; real validation requires a lab pilot with live telemetry.</div>
    </>
  );
}
