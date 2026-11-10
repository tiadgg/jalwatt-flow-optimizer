import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, evaluateJudgeTargets, judgeScenario, PEAK_TEST, runPeakLoad, runSimulation } from "@/engine";
import { buildSampleTelemetryCsv, parseTelemetryCsv } from "@/lib/telemetry-csv";

describe("peak load test", () => {
  it("runs 4 hours at 2x jobs with the rack held at max kW", () => {
    const result = runSimulation(DEFAULT_SETTINGS);
    const peak = runPeakLoad(DEFAULT_SETTINGS, result);
    expect(peak.steps).toHaveLength(PEAK_TEST.durationHours * PEAK_TEST.stepsPerHour);
    expect(peak.steps.every((step) => step.itKW === DEFAULT_SETTINGS.rackKW)).toBe(true);
    const firstHour = peak.steps[0]!.hour;
    expect(peak.steps[0]!.jobs * 4).toBeCloseTo(result.hourlyProfile[firstHour]!.baselineJobs * 2, 6);
  });

  it("passes with 0 crashes, 0 SLA violations and 0 throttling at defaults", () => {
    const peak = runPeakLoad(DEFAULT_SETTINGS, runSimulation(DEFAULT_SETTINGS));
    expect(peak.serverCrashes).toBe(0);
    expect(peak.slaViolations).toBe(0);
    expect(peak.throttlingEvents).toBe(0);
    expect(peak.pass).toBe(true);
  });

  it("fails when ambient heat erodes thermal headroom", () => {
    const hot = { ...DEFAULT_SETTINGS, ambientTempC: DEFAULT_SETTINGS.ambientTempC.map(() => 55) };
    const peak = runPeakLoad(hot, runSimulation(hot));
    expect(peak.throttlingEvents).toBeGreaterThan(0);
    expect(peak.pass).toBe(false);
  });
});

describe("Judge Mode preset", () => {
  it("hits PUE < 1.2, WUE < 0.2, a 20–30% energy saving and 0 SLA violations", () => {
    const settings = judgeScenario(DEFAULT_SETTINGS);
    const result = runSimulation(settings);
    expect(settings.cooling[settings.selectedCooling].pue).toBeLessThan(1.2);
    expect(settings.cooling[settings.selectedCooling].wue).toBeLessThan(0.2);
    expect(result.savingsPct).toBeGreaterThanOrEqual(20);
    expect(result.savingsPct).toBeLessThanOrEqual(30);
    expect(result.jalwatt.slaViolations).toBe(0);
    expect(evaluateJudgeTargets(settings, result).every((check) => check.met)).toBe(true);
  });
});

describe("telemetry CSV", () => {
  it("parses the sample with hour, itKW, ambientC, jobs into 24 rows", () => {
    const parsed = parseTelemetryCsv(buildSampleTelemetryCsv(DEFAULT_SETTINGS.ambientTempC));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.rows).toHaveLength(24);
  });

  it("rejects files missing a required column or an hour", () => {
    expect(parseTelemetryCsv("hour,itKW,jobs\n0,1,2").ok).toBe(false);
    const rows = ["hour,itKW,ambientC,jobs", ...Array.from({ length: 23 }, (_, h) => `${h},10,25,100`)];
    const result = parseTelemetryCsv(rows.join("\n"));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("23");
  });

  it("uses measured IT kWh as the baseline and the uploaded job counts", () => {
    const rows = Array.from({ length: 24 }, (_, hour) => ({ hour, itKW: 10, ambientC: 25, jobs: 100 }));
    const result = runSimulation({ ...DEFAULT_SETTINGS, telemetry: rows });
    expect(result.baseline.itKWh).toBeCloseTo(240, 6);
    expect(result.guarantees.totalJobs).toBe(2400);
    expect(result.jalwatt.itKWh).toBeLessThan(result.baseline.itKWh);
    expect(result.jalwatt.slaViolations).toBe(0);
  });
});
