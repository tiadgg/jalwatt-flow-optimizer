import type { TelemetryRow } from "@/engine";

export type TelemetryParseResult = { ok: true; rows: TelemetryRow[] } | { ok: false; error: string };

const REQUIRED = ["hour", "itkw", "ambientc", "jobs"] as const;

/** Parses an hourly telemetry CSV (hour, itKW, ambientC, jobs) entirely in the browser. */
export function parseTelemetryCsv(text: string): TelemetryParseResult {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));
  if (lines.length < 2) return { ok: false, error: "The file needs a header row and 24 hourly rows." };
  const header = (lines[0] ?? "").split(",").map((cell) => cell.trim().toLowerCase().replace(/["\s_]/g, ""));
  const index = Object.fromEntries(REQUIRED.map((name) => [name, header.indexOf(name)])) as Record<(typeof REQUIRED)[number], number>;
  const missing = REQUIRED.filter((name) => index[name] < 0);
  if (missing.length > 0) {
    return { ok: false, error: `Missing column${missing.length > 1 ? "s" : ""}: ${missing.map((name) => ({ hour: "hour", itkw: "itKW", ambientc: "ambientC", jobs: "jobs" })[name]).join(", ")}.` };
  }
  const byHour = new Map<number, TelemetryRow>();
  for (let lineNo = 1; lineNo < lines.length; lineNo += 1) {
    const cells = (lines[lineNo] ?? "").split(",").map((cell) => cell.trim().replace(/^"|"$/g, ""));
    const read = (name: (typeof REQUIRED)[number]) => Number(cells[index[name]] ?? "");
    const hour = read("hour");
    const itKW = read("itkw");
    const ambientC = read("ambientc");
    const jobs = read("jobs");
    const row = lineNo + 1;
    if (![hour, itKW, ambientC, jobs].every(Number.isFinite)) return { ok: false, error: `Row ${row} has a missing or non-numeric value.` };
    if (!Number.isInteger(hour) || hour < 0 || hour > 23) return { ok: false, error: `Row ${row}: hour must be a whole number from 0 to 23.` };
    if (itKW < 0 || jobs < 0) return { ok: false, error: `Row ${row}: itKW and jobs cannot be negative.` };
    if (ambientC < -20 || ambientC > 60) return { ok: false, error: `Row ${row}: ambientC must be between -20 and 60 °C.` };
    if (byHour.has(hour)) return { ok: false, error: `Hour ${hour} appears more than once.` };
    byHour.set(hour, { hour, itKW, ambientC, jobs: Math.round(jobs) });
  }
  const missingHours = Array.from({ length: 24 }, (_, hour) => hour).filter((hour) => !byHour.has(hour));
  if (missingHours.length > 0) return { ok: false, error: `Missing hour${missingHours.length > 1 ? "s" : ""}: ${missingHours.join(", ")}. Provide all 24 hours (0–23).` };
  const rows = Array.from({ length: 24 }, (_, hour) => byHour.get(hour) as TelemetryRow);
  const totalJobs = rows.reduce((sum, row) => sum + row.jobs, 0);
  if (totalJobs > 2_000_000) return { ok: false, error: "Total jobs exceed 2,000,000 per day; the browser simulator supports up to 2 million." };
  return { ok: true, rows };
}

/** Illustrative sample telemetry for a mid-size Bengaluru server room. */
export function buildSampleTelemetryCsv(ambientC: number[]): string {
  const lines = ["hour,itKW,ambientC,jobs"];
  for (let hour = 0; hour < 24; hour += 1) {
    const daytime = Math.max(0, Math.sin(((hour - 6) / 24) * 2 * Math.PI));
    const jobs = Math.round(150 + 350 * daytime);
    const itKW = Number((1.2 + jobs * 0.0062).toFixed(2));
    lines.push(`${hour},${itKW},${ambientC[hour] ?? 25},${jobs}`);
  }
  return `${lines.join("\n")}\n`;
}
