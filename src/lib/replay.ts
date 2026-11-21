import type { JalWattSettings, SimulationResult } from "@/engine";

export interface ReplaySample {
  timestamp: string;
  timestampMs: number;
  powerKW: number;
  inletTempC?: number;
}

export type ReplayParseResult =
  | { ok: true; samples: ReplaySample[]; intervalMs: number }
  | { ok: false; error: string };

export interface ReplayPoint extends ReplaySample {
  predictedPowerKW: number;
}

export interface ReplayMetrics {
  points: ReplayPoint[];
  measuredEnergyKWh: number;
  predictedEnergyKWh: number;
  mapePct: number | null;
  totalEnergyDifferencePct: number | null;
  estimatedSavingsKWh: number;
  projectedJalWattEnergyKWh: number;
}

function splitCsvRow(line: string): string[] | null {
  const cells: string[] = [];
  let cell = "";
  let quoted = false;
  let closedQuote = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === undefined) continue;
    if (quoted) {
      if (character === '"') {
        if (line[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else {
          quoted = false;
          closedQuote = true;
        }
      } else {
        cell += character;
      }
    } else if (character === ",") {
      cells.push(cell.trim());
      cell = "";
      closedQuote = false;
    } else if (character === '"' && cell.trim().length === 0 && !closedQuote) {
      cell = "";
      quoted = true;
    } else if (closedQuote && character.trim().length > 0) {
      return null;
    } else {
      cell += character;
    }
  }

  if (quoted) return null;
  cells.push(cell.trim());
  return cells;
}

function normalizeHeader(header: string) {
  return header.trim().toLowerCase().replace(/[\s()]+/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
}

function parseNumericCell(value: string) {
  const trimmed = value.trim();
  if (!/^[+-]?(?:(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)$/i.test(trimmed)) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function hasTimezone(timestamp: string) {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/i.test(timestamp);
}

function durationLabel(milliseconds: number) {
  const minutes = milliseconds / 60_000;
  if (Number.isInteger(minutes)) return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  return `${(milliseconds / 1000).toFixed(3)} seconds`;
}

/** Parses a UTC/offset-qualified power trace entirely in browser memory. */
export function parseReplayCsv(text: string): ReplayParseResult {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((raw, index) => ({ raw: raw.trim(), lineNumber: index + 1 }))
    .filter(({ raw }) => raw.length > 0 && !raw.startsWith("#"));

  if (lines.length < 2) return { ok: false, error: "Add a header row and at least two timestamped power samples." };

  const headerCells = splitCsvRow(lines[0]?.raw ?? "");
  if (!headerCells) return { ok: false, error: "The header row has invalid CSV quoting." };
  const headers = headerCells.map(normalizeHeader);
  if (new Set(headers).size !== headers.length) return { ok: false, error: "The header row contains duplicate columns." };

  const wrongUnitColumn = headers.find((header) => ["power_w", "power_mw", "inlet_temp_f"].includes(header));
  if (wrongUnitColumn === "power_w" || wrongUnitColumn === "power_mw") {
    return { ok: false, error: `Found ${wrongUnitColumn}; export power values in kW and name the column power_kw.` };
  }
  if (wrongUnitColumn === "inlet_temp_f") {
    return { ok: false, error: "Found inlet_temp_f; convert temperatures to °C and name the column inlet_temp_c." };
  }

  const timestampIndex = headers.indexOf("timestamp");
  const powerIndex = headers.indexOf("power_kw");
  const temperatureIndex = headers.indexOf("inlet_temp_c");
  const missing = [timestampIndex < 0 ? "timestamp" : null, powerIndex < 0 ? "power_kw" : null].filter(
    (column): column is string => column !== null,
  );
  if (missing.length > 0) {
    return { ok: false, error: `Missing required column${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}. Use power_kw for kW values.` };
  }

  const samples: ReplaySample[] = [];
  for (const { raw, lineNumber } of lines.slice(1)) {
    const cells = splitCsvRow(raw);
    if (!cells) return { ok: false, error: `Row ${lineNumber} has invalid CSV quoting.` };
    if (cells.length !== headers.length) {
      return { ok: false, error: `Row ${lineNumber} has ${cells.length} fields; the header has ${headers.length}.` };
    }

    const timestamp = cells[timestampIndex] ?? "";
    if (!hasTimezone(timestamp)) {
      return { ok: false, error: `Row ${lineNumber}: timestamp must be ISO 8601 with a timezone, such as 2026-01-01T00:00:00Z.` };
    }
    const timestampMs = Date.parse(timestamp);
    if (!Number.isFinite(timestampMs)) return { ok: false, error: `Row ${lineNumber}: timestamp is not a valid date and time.` };

    const rawPower = cells[powerIndex] ?? "";
    const powerKW = parseNumericCell(rawPower);
    if (powerKW === null) {
      return { ok: false, error: `Row ${lineNumber}: power_kw must be a plain numeric value in kW; remove W/MW suffixes and convert to kW.` };
    }
    if (powerKW < 0) return { ok: false, error: `Row ${lineNumber}: power_kw cannot be negative.` };

    const rawTemperature = temperatureIndex >= 0 ? (cells[temperatureIndex] ?? "") : "";
    const inletTempC = rawTemperature.length > 0 ? parseNumericCell(rawTemperature) : null;
    if (rawTemperature.length > 0 && inletTempC === null) {
      return { ok: false, error: `Row ${lineNumber}: inlet_temp_c must be a numeric temperature in °C.` };
    }
    samples.push({
      timestamp,
      timestampMs,
      powerKW,
      ...(inletTempC !== null ? { inletTempC } : {}),
    });
  }

  if (samples.length < 2) return { ok: false, error: "Add at least two timestamped power samples." };
  const first = samples[0];
  const second = samples[1];
  if (!first || !second) return { ok: false, error: "Add at least two timestamped power samples." };
  const intervalMs = second.timestampMs - first.timestampMs;
  if (intervalMs <= 0) return { ok: false, error: "Timestamps must be strictly increasing with no duplicates." };

  for (let index = 2; index < samples.length; index += 1) {
    const previous = samples[index - 1];
    const current = samples[index];
    if (!previous || !current) continue;
    const interval = current.timestampMs - previous.timestampMs;
    if (interval <= 0) return { ok: false, error: `Row ${lines[index + 1]?.lineNumber ?? index + 2}: timestamps must be strictly increasing with no duplicates.` };
    if (interval !== intervalMs) {
      const detail = interval > intervalMs ? "A sampling gap was found" : "The sampling interval changed";
      return {
        ok: false,
        error: `Row ${lines[index + 1]?.lineNumber ?? index + 2}: ${detail}; expected every ${durationLabel(intervalMs)} but found ${durationLabel(interval)}.`,
      };
    }
  }

  return { ok: true, samples, intervalMs };
}

function integratePower(points: ReplayPoint[], getPower: (point: ReplayPoint) => number) {
  let energyKWh = 0;
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    if (!previous || !current) continue;
    const durationHours = (current.timestampMs - previous.timestampMs) / 3_600_000;
    energyKWh += ((getPower(previous) + getPower(current)) / 2) * durationHours;
  }
  return energyKWh;
}

/** Compares the measured trace with the engine's hourly JalWatt facility profile. */
export function calculateReplayMetrics(samples: ReplaySample[], result: SimulationResult): ReplayMetrics {
  const predictedByHour = new Map(result.hourlyProfile.map((hour) => [hour.hour, hour.jalwattKWh]));
  const points = samples.map((sample): ReplayPoint => {
    const hourUTC = new Date(sample.timestampMs).getUTCHours();
    return {
      ...sample,
      predictedPowerKW: predictedByHour.get(hourUTC) ?? 0,
    };
  });
  const measuredEnergyKWh = integratePower(points, (point) => point.powerKW);
  const predictedEnergyKWh = integratePower(points, (point) => point.predictedPowerKW);
  const nonZeroMeasured = points.filter((point) => point.powerKW > 0);
  const mapePct = nonZeroMeasured.length > 0
    ? nonZeroMeasured.reduce((sum, point) => sum + Math.abs(point.predictedPowerKW - point.powerKW) / point.powerKW, 0) /
      nonZeroMeasured.length *
      100
    : null;
  const totalEnergyDifferencePct = measuredEnergyKWh > 0
    ? ((predictedEnergyKWh - measuredEnergyKWh) / measuredEnergyKWh) * 100
    : null;
  const estimatedSavingsKWh = measuredEnergyKWh * (result.savingsPct / 100);

  return {
    points,
    measuredEnergyKWh,
    predictedEnergyKWh,
    mapePct,
    totalEnergyDifferencePct,
    estimatedSavingsKWh,
    projectedJalWattEnergyKWh: measuredEnergyKWh - estimatedSavingsKWh,
  };
}

/** Creates an explicitly synthetic trace from the seeded engine's current scenario output. */
export function buildSyntheticReplayCsv(settings: JalWattSettings, result: SimulationResult) {
  const lines = [
    "# SYNTHETIC SAMPLE, NOT REAL DATA — generated from JalWatt's seeded simulation; timestamps are illustrative UTC.",
    `# Simulation seed: ${settings.seed}`,
    "timestamp,power_kw,inlet_temp_c",
  ];
  const start = Date.UTC(2026, 0, 1);
  for (let index = 0; index <= 24; index += 1) {
    const hour = index % 24;
    const predictedPowerKW = result.hourlyProfile[hour]?.jalwattKWh ?? 0;
    const inletTempC = settings.ambientTempC[hour] ?? 0;
    const timestamp = new Date(start + index * 3_600_000).toISOString();
    lines.push(`${timestamp},${predictedPowerKW.toFixed(4)},${inletTempC.toFixed(1)}`);
  }
  return `${lines.join("\n")}\n`;
}