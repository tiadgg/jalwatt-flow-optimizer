import { useMemo, useRef, useState } from "react";
import { AlertTriangle, Download, FileUp, LockKeyhole, LoaderCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import type { JalWattSettings, SimulationResult } from "@/engine";
import { buildSyntheticReplayCsv, calculateReplayMetrics, parseReplayCsv, type ReplaySample } from "@/lib/replay";
import { chartTooltipStyle, PanelHeading } from "./shared";

export function ReplayView({ settings, result }: { settings: JalWattSettings; result: SimulationResult }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [samples, setSamples] = useState<ReplaySample[] | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const metrics = useMemo(() => (samples ? calculateReplayMetrics(samples, result) : null), [samples, result]);
  const chartData = useMemo(
    () => metrics?.points.map((point) => ({
      ...point,
      label: new Date(point.timestampMs).toISOString().slice(0, 16).replace("T", " "),
    })) ?? [],
    [metrics],
  );
  const hasTemperature = samples?.some((sample) => sample.inletTempC !== undefined) ?? false;

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setSamples(null);
    setFileName(null);
    try {
      const parsed = parseReplayCsv(await file.text());
      if (!parsed.ok) {
        setError(parsed.error);
        return;
      }
      setSamples(parsed.samples);
      setFileName(file.name);
      toast.success("Replay loaded", { description: `${parsed.samples.length.toLocaleString("en-IN")} samples · processed in this browser` });
    } catch {
      setError("This file could not be read. Choose a readable CSV file and try again.");
    } finally {
      setLoading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const downloadSample = () => {
    const csv = buildSyntheticReplayCsv(settings, result);
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "jalwatt-synthetic-sample-not-real-data.csv";
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success("Synthetic sample downloaded", { description: "Synthetic sample, not real data" });
  };

  return (
    <>
      <PanelHeading
        eyebrow="Phase 1 pilot"
        title="Replay measured telemetry"
        description="Compare a measured power trace with the current JalWatt model for the same timestamps."
      />

      <section className="border border-primary/30 bg-primary/5 p-4 sm:p-5">
        <p className="text-sm font-medium">This is Phase 1 of the pilot: replay measured telemetry and measure the model's error.</p>
        <p className="mt-2 flex items-start gap-2 text-xs leading-5 text-muted-foreground">
          <LockKeyhole className="mt-0.5 size-3.5 shrink-0 text-primary" />
          CSV data is read and kept in this browser only. Use timezone-qualified timestamps at a consistent sampling interval. The <code className="font-mono text-foreground">power_kw</code> column is treated as facility-meter power and compared with the engine's facility forecast.
        </p>
      </section>

      <section className="mt-5 border border-border bg-card p-4 sm:p-5" aria-label="Upload replay telemetry">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div className="max-w-2xl">
            <div className="text-sm font-semibold">Replay CSV</div>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Required: <code className="font-mono text-foreground">timestamp,power_kw</code>. Optional: <code className="font-mono text-foreground">inlet_temp_c</code>. Timestamps must include a timezone and have an even interval; power values must be numeric kW.
            </p>
            <p className="mt-2 text-[11px] text-chart-3">Synthetic sample, not real data: the downloadable example is generated from the current seeded simulation.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileInput}
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              aria-label="Replay CSV file"
              onChange={(event) => onFile(event.target.files?.[0])}
            />
            <Button variant="outline" onClick={downloadSample}><Download className="size-4" />Download sample CSV</Button>
            <Button onClick={() => fileInput.current?.click()} disabled={loading}>
              {loading ? <LoaderCircle className="size-4 animate-spin" /> : <FileUp className="size-4" />}
              {loading ? "Reading…" : "Upload CSV"}
            </Button>
            {samples && <Button variant="ghost" onClick={() => { setSamples(null); setFileName(null); setError(null); }}><Trash2 className="size-4" />Clear</Button>}
          </div>
        </div>
        {error && <div role="alert" className="mt-4 flex items-start gap-2 border border-destructive/40 bg-destructive/10 p-3 text-xs leading-5 text-destructive"><AlertTriangle className="mt-0.5 size-4 shrink-0" />{error}</div>}
        {fileName && <div role="status" className="mt-4 text-xs text-muted-foreground">Loaded <span className="font-mono text-foreground">{fileName}</span> · {samples?.length.toLocaleString("en-IN")} samples · data remains in this browser</div>}
      </section>

      {metrics && (
        <>
          <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Replay results">
            <ReplayMetric label="Measured energy" value={`${metrics.measuredEnergyKWh.toFixed(2)} kWh`} detail="Integrated from the uploaded power trace" />
            <ReplayMetric label="JalWatt model prediction" value={`${metrics.predictedEnergyKWh.toFixed(2)} kWh`} detail="Engine facility forecast over this period" />
            <ReplayMetric label="MAPE" value={metrics.mapePct === null ? "—" : `${metrics.mapePct.toFixed(1)}%`} detail="Mean absolute power error; zero-load samples excluded" />
            <ReplayMetric label="Total-energy difference" value={metrics.totalEnergyDifferencePct === null ? "—" : `${metrics.totalEnergyDifferencePct > 0 ? "+" : ""}${metrics.totalEnergyDifferencePct.toFixed(1)}%`} detail="Model prediction minus measured energy, relative to measured" />
          </section>

          <section className="mt-5 border border-border bg-card p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold">Measured and predicted load</h3>
                <p className="mt-1 text-xs text-muted-foreground">Measured facility power and the engine's JalWatt hourly forecast; timestamps shown in UTC.</p>
              </div>
              <div className="text-right text-[10px] leading-4 text-muted-foreground">Current scenario · {settings.city} · {settings.selectedCooling} cooling<br />Seed {settings.seed}</div>
            </div>
            <div className="mt-4 h-[300px] w-full" role="img" aria-label="Line chart comparing measured and JalWatt-predicted power over time">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 8, right: hasTemperature ? 10 : 20, left: -16, bottom: 6 }}>
                  <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 5" vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} stroke="var(--color-muted-foreground)" fontSize={10} minTickGap={32} />
                  <YAxis yAxisId="power" tickLine={false} axisLine={false} stroke="var(--color-muted-foreground)" fontSize={10} width={54} tickFormatter={(value: number) => `${value} kW`} />
                  {hasTemperature && <YAxis yAxisId="temperature" orientation="right" tickLine={false} axisLine={false} stroke="var(--color-chart-3)" fontSize={10} width={48} tickFormatter={(value: number) => `${value}°`} />}
                  <Tooltip contentStyle={chartTooltipStyle} labelFormatter={(label) => `${String(label)} UTC`} formatter={(value, name) => [typeof value === "number" ? value.toFixed(2) : String(value), name]} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line yAxisId="power" type="monotone" dataKey="powerKW" name="Measured power (kW)" stroke="var(--color-chart-2)" strokeWidth={2} dot={false} isAnimationActive={false} />
                  <Line yAxisId="power" type="monotone" dataKey="predictedPowerKW" name="JalWatt prediction (kW)" stroke="var(--color-chart-1)" strokeWidth={2} strokeDasharray="5 4" dot={false} isAnimationActive={false} />
                  {hasTemperature && <Line yAxisId="temperature" type="monotone" dataKey="inletTempC" name="Inlet temperature (°C)" stroke="var(--color-chart-3)" strokeWidth={1.5} dot={false} connectNulls={false} isAnimationActive={false} />}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="mt-5 border border-primary/30 bg-primary/5 p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold">Estimated savings on this measured load</h3>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">Applies the current engine scenario's facility-energy saving rate ({result.savingsPct.toFixed(1)}%) to the measured period. This is a model-based estimate, not measured savings.</p>
              </div>
              <div className="text-right font-mono text-xl tabular-nums text-primary">{metrics.estimatedSavingsKWh.toFixed(2)} kWh</div>
            </div>
            <p className="mt-3 border-t border-primary/20 pt-3 text-xs text-muted-foreground">Projected energy after the scenario: <span className="font-mono text-foreground">{metrics.projectedJalWattEnergyKWh.toFixed(2)} kWh</span> · Current cooling: <span className="font-mono text-foreground">PUE {settings.cooling[settings.selectedCooling].pue.toFixed(2)} · WUE {settings.cooling[settings.selectedCooling].wue.toFixed(2)} L/kWh</span>.</p>
          </section>
        </>
      )}
    </>
  );
}

function ReplayMetric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="min-w-0 border border-border bg-card p-4">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="mt-3 break-words font-mono text-2xl font-semibold tabular-nums">{value}</div>
      <p className="mt-2 text-[10px] leading-4 text-muted-foreground">{detail}</p>
    </div>
  );
}