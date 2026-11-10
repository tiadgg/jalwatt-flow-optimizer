import { useRef, useState } from "react";
import { Download, FileUp, Loader2, Lock, Radio, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useSettings } from "@/context/settings-context";
import { DEFAULT_SETTINGS } from "@/engine";
import { buildSampleTelemetryCsv, parseTelemetryCsv } from "@/lib/telemetry-csv";

export function downloadSampleTelemetry() {
  const blob = new Blob([buildSampleTelemetryCsv(DEFAULT_SETTINGS.ambientTempC)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "jalwatt-sample-telemetry.csv";
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast.success("Sample CSV downloaded", { description: "jalwatt-sample-telemetry.csv" });
}

export function TelemetryUpload() {
  const { settings, setTelemetry } = useSettings();
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      if (file.size > 2_000_000) throw new Error("File is larger than 2 MB. Upload 24 hourly rows.");
      const parsed = parseTelemetryCsv(await file.text());
      if (!parsed.ok) throw new Error(parsed.error);
      setTelemetry(parsed.rows);
      setFileName(file.name);
      toast.success("Using your telemetry", { description: `${file.name} · 24 hours loaded in your browser` });
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Could not read this file.";
      setError(message);
      toast.error("Telemetry not loaded", { description: message });
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <section className="mb-5 border border-border bg-card p-5" aria-label="Upload telemetry">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
        <div className="max-w-2xl">
          <div className="flex items-center gap-2 text-sm font-semibold"><FileUp className="size-4 text-primary" />Upload your telemetry</div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            CSV with 24 rows and columns <code className="font-mono text-foreground">hour, itKW, ambientC, jobs</code>. It replaces the hourly profile and re-runs the simulation: measured IT load becomes the baseline, and jobs arrive at the hours you recorded.
          </p>
          <p className="mt-2 flex items-center gap-1.5 text-[11px] text-primary"><Lock className="size-3" />Read in your browser only — your data is never sent anywhere.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input ref={inputRef} type="file" accept=".csv,text/csv" className="sr-only" aria-label="Telemetry CSV file" onChange={(event) => onFile(event.target.files?.[0])} />
          <Button variant="outline" onClick={downloadSampleTelemetry}><Download className="size-4" />Sample CSV</Button>
          <Button onClick={() => inputRef.current?.click()} disabled={loading}>{loading ? <Loader2 className="size-4 animate-spin" /> : <FileUp className="size-4" />}{loading ? "Reading…" : "Upload CSV"}</Button>
          {settings.telemetry && <Button variant="ghost" onClick={() => { setTelemetry(null); setFileName(null); toast("Back to the simulated profile"); }}><X className="size-4" />Remove</Button>}
        </div>
      </div>
      {error && <div role="alert" className="mt-4 border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">{error}</div>}
      {settings.telemetry && !error && <div className="mt-4 text-xs text-muted-foreground">Loaded {fileName ? <span className="font-mono text-foreground">{fileName}</span> : "telemetry"} · {settings.telemetry.reduce((sum, row) => sum + row.jobs, 0).toLocaleString("en-IN")} jobs · {settings.telemetry.reduce((sum, row) => sum + row.itKW, 0).toFixed(1)} kWh IT load</div>}
    </section>
  );
}

export function TelemetryBanner({ onManage }: { onManage: () => void }) {
  const { settings, setTelemetry } = useSettings();
  if (!settings.telemetry) return null;
  const jobs = settings.telemetry.reduce((sum, row) => sum + row.jobs, 0);
  return (
    <div role="status" className="mb-5 flex flex-col justify-between gap-3 border border-chart-2/40 bg-chart-2/10 p-3 sm:flex-row sm:items-center print:hidden">
      <div className="flex items-center gap-2.5 text-sm">
        <Radio className="size-4 shrink-0 text-chart-2" />
        <span><span className="font-semibold text-chart-2">Using your telemetry</span><span className="text-muted-foreground"> · 24 hours · {jobs.toLocaleString("en-IN")} jobs · processed only in this browser</span></span>
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="ghost" onClick={onManage}>Manage</Button>
        <Button size="sm" variant="outline" onClick={() => { setTelemetry(null); toast("Back to the simulated profile"); }}>Use simulated profile</Button>
      </div>
    </div>
  );
}
