import { describe, expect, it } from "vitest";
import { bestCaseScenario, DEFAULT_SETTINGS, judgeScenario, runSimulation } from "@/engine";
import { buildSyntheticReplayCsv, calculateReplayMetrics, parseReplayCsv } from "@/lib/replay";

describe("Replay CSV parsing", () => {
  it("parses UTC power samples and the optional inlet temperature", () => {
    const parsed = parseReplayCsv([
      "timestamp,power_kw,inlet_temp_c",
      "2026-01-01T00:00:00Z,10,24.5",
      "2026-01-01T00:15:00Z,11,25",
    ].join("\n"));

    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.samples).toHaveLength(2);
      expect(parsed.samples[0]?.powerKW).toBe(10);
      expect(parsed.samples[0]?.inletTempC).toBe(24.5);
      expect(parsed.intervalMs).toBe(15 * 60 * 1000);
    }
  });

  it("rejects incorrect unit headers and unit-suffixed values", () => {
    const wrongHeader = parseReplayCsv("timestamp,power_w\n2026-01-01T00:00:00Z,10000\n2026-01-01T01:00:00Z,10000");
    expect(wrongHeader.ok).toBe(false);
    if (!wrongHeader.ok) expect(wrongHeader.error).toContain("export power values in kW");

    const wrongValue = parseReplayCsv("timestamp,power_kw\n2026-01-01T00:00:00Z,10 kW\n2026-01-01T01:00:00Z,10");
    expect(wrongValue.ok).toBe(false);
    if (!wrongValue.ok) expect(wrongValue.error).toContain("plain numeric value in kW");
  });

  it("rejects timezone-free timestamps, missing required columns, and sampling gaps", () => {
    expect(parseReplayCsv("timestamp,power_kw\n2026-01-01T00:00:00,10\n2026-01-01T01:00:00,10").ok).toBe(false);
    expect(parseReplayCsv("timestamp\n2026-01-01T00:00:00Z\n2026-01-01T01:00:00Z").ok).toBe(false);

    const gap = parseReplayCsv([
      "timestamp,power_kw",
      "2026-01-01T00:00:00Z,10",
      "2026-01-01T01:00:00Z,10",
      "2026-01-01T03:00:00Z,10",
    ].join("\n"));
    expect(gap.ok).toBe(false);
    if (!gap.ok) expect(gap.error).toContain("sampling gap");
  });

  it("rejects nonnumeric and negative readings with row-specific errors", () => {
    const nonnumeric = parseReplayCsv("timestamp,power_kw\n2026-01-01T00:00:00Z,abc\n2026-01-01T01:00:00Z,10");
    expect(nonnumeric.ok).toBe(false);
    if (!nonnumeric.ok) expect(nonnumeric.error).toContain("Row 2");

    const negative = parseReplayCsv("timestamp,power_kw\n2026-01-01T00:00:00Z,-1\n2026-01-01T01:00:00Z,10");
    expect(negative.ok).toBe(false);
    if (!negative.ok) expect(negative.error).toContain("cannot be negative");
  });
});

describe("Replay model comparison", () => {
  it("integrates energy, computes MAPE and energy difference, and applies modeled savings to measured energy", () => {
    const result = runSimulation(DEFAULT_SETTINGS);
    const parsed = parseReplayCsv([
      "timestamp,power_kw",
      "2026-01-01T00:00:00Z,10",
      "2026-01-01T01:00:00Z,12",
      "2026-01-01T02:00:00Z,8",
    ].join("\n"));
    if (!parsed.ok) throw new Error(parsed.error);

    const metrics = calculateReplayMetrics(parsed.samples, result);
    const expectedPrediction = result.hourlyProfile.slice(0, 3).map((hour) => hour?.jalwattKWh ?? 0);
    const expectedMape = expectedPrediction.reduce((sum, prediction, index) => {
      const measured = [10, 12, 8][index] ?? 0;
      return sum + Math.abs(prediction - measured) / measured;
    }, 0) / 3 * 100;
    const expectedPredictedEnergy = ((expectedPrediction[0] ?? 0) + (expectedPrediction[1] ?? 0)) / 2 +
      ((expectedPrediction[1] ?? 0) + (expectedPrediction[2] ?? 0)) / 2;

    expect(metrics.measuredEnergyKWh).toBe(21);
    expect(metrics.predictedEnergyKWh).toBeCloseTo(expectedPredictedEnergy, 10);
    expect(metrics.mapePct).toBeCloseTo(expectedMape, 10);
    expect(metrics.totalEnergyDifferencePct).toBeCloseTo(((expectedPredictedEnergy - 21) / 21) * 100, 10);
    expect(metrics.estimatedSavingsKWh).toBeCloseTo(21 * result.savingsPct / 100, 10);
    expect(metrics.projectedJalWattEnergyKWh).toBeCloseTo(21 - metrics.estimatedSavingsKWh, 10);
  });

  it("returns an unavailable MAPE for an all-zero measured trace", () => {
    const parsed = parseReplayCsv("timestamp,power_kw\n2026-01-01T00:00:00Z,0\n2026-01-01T01:00:00Z,0");
    if (!parsed.ok) throw new Error(parsed.error);
    const metrics = calculateReplayMetrics(parsed.samples, runSimulation(DEFAULT_SETTINGS));
    expect(metrics.measuredEnergyKWh).toBe(0);
    expect(metrics.mapePct).toBeNull();
    expect(metrics.totalEnergyDifferencePct).toBeNull();
  });

  it("creates a deterministic, explicitly synthetic sample from the seeded engine output", () => {
    const result = runSimulation(DEFAULT_SETTINGS);
    const first = buildSyntheticReplayCsv(DEFAULT_SETTINGS, result);
    expect(first).toBe(buildSyntheticReplayCsv(DEFAULT_SETTINGS, result));
    expect(first).toContain("SYNTHETIC SAMPLE, NOT REAL DATA");
    expect(first).toContain("timestamp,power_kw,inlet_temp_c");
    const parsed = parseReplayCsv(first);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.samples).toHaveLength(25);
  });
});

describe("existing scenario results remain unchanged", () => {
  it("keeps Default, Conservative, and Best case facility savings at their verified values", () => {
    const conservative = judgeScenario(DEFAULT_SETTINGS);
    const scenarios = [
      ["Default", DEFAULT_SETTINGS, "58.8%"],
      ["Conservative", conservative, "54.3%"],
      ["Best case", bestCaseScenario(conservative), "73.3%"],
    ] as const;
    for (const [label, settings, expected] of scenarios) {
      expect(`${runSimulation(settings).savingsPct.toFixed(1)}%`, label).toBe(expected);
    }
  });
});